"""Restaurant Continuity Mode — demo reference implementation.
Uses SQLite transactions to enforce table inventory server-side. Not a production deployment.
"""
import csv
import hashlib
import io
import json
import os
import re
import secrets
import sqlite3
import threading
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

BASE = Path(__file__).parent
DB = Path(os.getenv('RCM_DB', BASE / 'continuity.db'))
VENUE_TZ = 'America/New_York'
TZ = ZoneInfo(VENUE_TZ)
BUFFER = 15
SERVICE_START, SERVICE_END = '17:00', '23:00'
APP = FastAPI(title='Restaurant Continuity Mode', version='1.0.0')
app = APP


def db():
    conn = sqlite3.connect(str(DB), timeout=20, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA busy_timeout = 20000')
    return conn


@contextmanager
def tx(immediate=True):
    c = db()
    try:
        c.execute('BEGIN IMMEDIATE' if immediate else 'BEGIN')
        yield c
        c.commit()
    except Exception:
        c.rollback()
        raise
    finally:
        c.close()


def now():
    return datetime.now(timezone.utc).isoformat()


def local_date():
    return datetime.now(TZ).date().isoformat()


def dt_utc(d, t):
    try:
        x = datetime.fromisoformat(f'{d}T{t}')
        if len(d) != 10 or len(t) != 5 or x.date().isoformat() != d:
            raise ValueError('invalid')
        x = x.replace(tzinfo=TZ)
        if x.astimezone(timezone.utc).astimezone(TZ).replace(tzinfo=None) != x.replace(tzinfo=None):
            raise ValueError('nonexistent local time')
        return x.astimezone(timezone.utc).isoformat()
    except (ValueError, TypeError):
        raise HTTPException(422, 'Date/time must be valid local YYYY-MM-DD and HH:MM.')


def local(utc):
    return datetime.fromisoformat(utc).astimezone(TZ).strftime('%Y-%m-%dT%H:%M') if utc else None


def plus(utc, minutes):
    return (datetime.fromisoformat(utc) + timedelta(minutes=minutes)).isoformat()


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 180_000).hex()


def audit(c, actor, action, entity_type, entity_id, detail=''):
    c.execute('INSERT INTO audit(actor,action,entity_type,entity_id,detail,created_at) VALUES(?,?,?,?,?,?)',
              (actor, action, entity_type, str(entity_id), detail[:300], now()))


def init_db():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with tx() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, role TEXT NOT NULL, display_name TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS venue (id INTEGER PRIMARY KEY, name TEXT NOT NULL, timezone TEXT NOT NULL, covers_limit INTEGER, turnover_buffer INTEGER);
        CREATE TABLE IF NOT EXISTS venue_tables (id INTEGER PRIMARY KEY, label TEXT UNIQUE NOT NULL, area TEXT NOT NULL, seats INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1);
        CREATE TABLE IF NOT EXISTS incidents (id INTEGER PRIMARY KEY, service_date TEXT NOT NULL, state TEXT NOT NULL, reason TEXT, started_at TEXT, ended_at TEXT, started_by TEXT, signed_by TEXT, signed_reason TEXT);
        CREATE TABLE IF NOT EXISTS verifications (id INTEGER PRIMARY KEY, table_id INTEGER REFERENCES venue_tables(id), service_date TEXT NOT NULL, starts_utc TEXT NOT NULL, ends_utc TEXT NOT NULL, verified_by TEXT NOT NULL, verified_at TEXT NOT NULL, UNIQUE(table_id,service_date,starts_utc,ends_utc));
        CREATE TABLE IF NOT EXISTS holds (id INTEGER PRIMARY KEY, table_id INTEGER REFERENCES venue_tables(id), service_date TEXT NOT NULL, starts_utc TEXT NOT NULL, ends_utc TEXT NOT NULL, reason TEXT NOT NULL, created_by TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY, incident_id INTEGER REFERENCES incidents(id), service_date TEXT NOT NULL,
            guest_name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', party_size INTEGER NOT NULL,
            starts_utc TEXT NOT NULL, ends_utc TEXT NOT NULL, block_ends_utc TEXT NOT NULL,
            table_id INTEGER REFERENCES venue_tables(id), source TEXT NOT NULL, state TEXT NOT NULL,
            verification TEXT NOT NULL, confirmation_code TEXT UNIQUE, note TEXT NOT NULL DEFAULT '',
            idempotency_key TEXT UNIQUE, version INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL,
            created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_booking_table_time ON bookings(table_id,starts_utc,block_ends_utc);
        CREATE INDEX IF NOT EXISTS idx_booking_date ON bookings(service_date);
        CREATE TABLE IF NOT EXISTS conflicts (
            id INTEGER PRIMARY KEY, incident_id INTEGER, booking_id INTEGER REFERENCES bookings(id),
            kind TEXT NOT NULL, severity TEXT NOT NULL, description TEXT NOT NULL,
            state TEXT NOT NULL DEFAULT 'open', resolution TEXT, resolved_by TEXT, resolved_at TEXT, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS imports (id INTEGER PRIMARY KEY, incident_id INTEGER, origin TEXT NOT NULL, source_as_of TEXT, rows_ok INTEGER, rows_rejected INTEGER, created_by TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS reconciliations (id INTEGER PRIMARY KEY, incident_id INTEGER, uploaded_by TEXT, uploaded_at TEXT, matches INTEGER, provider_only INTEGER, local_only INTEGER, changed INTEGER, invalid_rows INTEGER);
        CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, actor TEXT, action TEXT, entity_type TEXT, entity_id TEXT, detail TEXT, created_at TEXT);
        ''')
        if c.execute('SELECT COUNT(*) FROM users').fetchone()[0]:
            return
        for username, role, name in [('manager','manager','Alex Morgan'),('host','host','Jamie Rivera')]:
            salt = secrets.token_hex(16)
            c.execute('INSERT INTO users(username,role,display_name,salt,password_hash) VALUES(?,?,?,?,?)',
                      (username,role,name,salt,hash_password('demo123!',salt)))
        c.execute('INSERT INTO venue(id,name,timezone,covers_limit,turnover_buffer) VALUES(1,?,?,16,15)', ('The Marigold Room', VENUE_TZ))
        tables = [('T01','Main dining',2),('T02','Main dining',2),('T03','Main dining',4),('T04','Main dining',4),
                  ('T05','Main dining',2),('T06','Main dining',4),('T07','Main dining',6),('T08','Main dining',4),
                  ('P01','Garden patio',2),('P02','Garden patio',2),('P03','Garden patio',4),('P04','Garden patio',4),
                  ('P05','Garden patio',2),('P06','Garden patio',6)]
        for label,area,seats in tables:
            c.execute('INSERT INTO venue_tables(label,area,seats) VALUES(?,?,?)',(label,area,seats))
        d=local_date()
        c.execute("INSERT INTO incidents(service_date,state,reason,started_at,started_by) VALUES(?,?,?,?,?)", (d,'active','Simulated Resy service interruption',now(),'Alex Morgan'))
        iid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        for tid in [1,2,3,4,5,6,7,8,9,10]:
            c.execute('INSERT INTO verifications(table_id,service_date,starts_utc,ends_utc,verified_by,verified_at) VALUES(?,?,?,?,?,?)',
                      (tid,d,dt_utc(d,'17:00'),dt_utc(d,'23:00'),'Alex Morgan',now()))
        c.execute('INSERT INTO holds(table_id,service_date,starts_utc,ends_utc,reason,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
                  (8,d,dt_utc(d,'18:00'),dt_utc(d,'20:00'),'Safety buffer for unassigned guest claims','Alex Morgan',now()))
        seeds = [('Avery Chen',2,'17:30',1,'verified_existing'),('Jordan Patel',4,'18:00',3,'verified_existing'),
                 ('Taylor Brooks',2,'18:15',2,'verified_existing'),('Morgan Lee',4,'18:30',4,'verified_existing'),
                 ('Riley Wilson',2,'19:00',5,'verified_existing'),('Samira Khan',6,'19:15',7,'verified_existing'),
                 ('Cameron Ellis',2,'20:00',9,'verified_existing'),('Casey Alvarez',4,'20:15',6,'verified_existing'),
                 ('Robin Fields',2,'19:30',None,'imported_unverified')]
        for guest,party,at,tid,state in seeds:
            start=dt_utc(d,at); end=plus(start,90 if party<=2 else 120)
            c.execute('''INSERT INTO bookings(incident_id,service_date,guest_name,phone,party_size,starts_utc,ends_utc,block_ends_utc,table_id,source,state,verification,confirmation_code,created_by,created_at,updated_at)
                         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                      (iid,d,guest,'',party,start,end,plus(end,BUFFER),tid,'Shift Digest backup',state,
                       'verified' if state=='verified_existing' else 'unverified',f'BACKUP-{iid}-{c.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]+1:03d}' if tid else None,'seed',now(),now()))
        unassigned=c.execute("SELECT id FROM bookings WHERE table_id IS NULL LIMIT 1").fetchone()[0]
        c.execute('INSERT INTO conflicts(incident_id,booking_id,kind,severity,description,created_at) VALUES(?,?,?,?,?,?)',
                  (iid,unassigned,'unassigned_existing','high','Imported guest commitment has no verified table. Review the protected capacity buffer.',now()))
        c.execute('INSERT INTO imports(incident_id,origin,source_as_of,rows_ok,rows_rejected,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
                  (iid,'Resy Shift Digest (demo seed)',f'{d} 14:00',9,0,'seed',now()))
        audit(c,'system','demo_seed','incident',iid,'Fictional sample service data loaded; not an actual Resy connection')


init_db()
APP.mount('/static', StaticFiles(directory=str(BASE / 'static')), name='static')


@APP.get('/')
def homepage():
    return FileResponse(BASE / 'static' / 'index.html')


@APP.get('/health')
def health():
    return {'ok':True, 'mode':'independent-service'}


def auth(authorization: str | None, roles=None):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(401, 'Please sign in.')
    tok=authorization[7:].strip()
    with db() as c:
        u=c.execute('''SELECT u.id,u.username,u.role,u.display_name FROM sessions s JOIN users u ON s.user_id=u.id
                      WHERE s.token_hash=? AND s.expires_at>?''', (hashlib.sha256(tok.encode()).hexdigest(),now())).fetchone()
    if not u:
        raise HTTPException(401,'Session expired; sign in again.')
    user=dict(u)
    if roles and user['role'] not in roles:
        raise HTTPException(403,'Manager authorization required.')
    return user


class Login(BaseModel):
    username: str
    password: str


@APP.post('/api/login')
def login(payload: Login):
    with db() as c:
        u=c.execute('SELECT * FROM users WHERE username=?',(payload.username,)).fetchone()
    if not u or not secrets.compare_digest(hash_password(payload.password,u['salt']),u['password_hash']):
        raise HTTPException(401,'Invalid credentials.')
    token=secrets.token_urlsafe(36)
    expires=(datetime.now(timezone.utc)+timedelta(hours=10)).isoformat()
    with tx() as c:
        c.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),u['id'],expires))
        audit(c,u['username'],'login','session',u['id'],'Signed in to demo workspace')
    return {'token':token,'user':{'username':u['username'],'role':u['role'],'display_name':u['display_name']}}


@APP.post('/api/logout')
def logout(authorization: str | None = Header(None)):
    u=auth(authorization)
    with tx() as c:
        c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(authorization[7:].encode()).hexdigest(),))
    return {'ok':True}


def incident(c,d):
    return c.execute('SELECT * FROM incidents WHERE service_date=? ORDER BY id DESC LIMIT 1',(d,)).fetchone()


def booking_dict(r):
    b=dict(r)
    b['time']=local(b['starts_utc'])[11:]
    b['date']=b['service_date']
    b['end_time']=local(b['ends_utc'])[11:]
    return b


def verify_for(c,tid,d,start,block_end):
    return bool(c.execute('''SELECT 1 FROM verifications WHERE table_id=? AND service_date=? AND starts_utc<=? AND ends_utc>=? LIMIT 1''',(tid,d,start,block_end)).fetchone())


def overlap(c,tid,start,block_end,exclude=None):
    b=c.execute('''SELECT id,guest_name,state FROM bookings WHERE table_id=? AND state NOT IN ('cancelled','no_show')
                 AND starts_utc<? AND block_ends_utc>? AND (? IS NULL OR id!=?) LIMIT 1''',(tid,block_end,start,exclude,exclude)).fetchone()
    h=c.execute('SELECT id,reason FROM holds WHERE table_id=? AND starts_utc<? AND ends_utc>? LIMIT 1',(tid,block_end,start)).fetchone()
    return ('booking',dict(b)) if b else (('hold',dict(h)) if h else None)


def candidates(c,d,time,party):
    start=dt_utc(d,time)
    dur=90 if party<=2 else 120
    end=plus(start,dur)
    bend=plus(end,BUFFER)
    res=[]
    for t in c.execute('SELECT * FROM venue_tables WHERE active=1 ORDER BY id'):
        t=dict(t)
        if t['seats']<party:
            state='too_small'; reason='Table capacity below party size'
        elif not verify_for(c,t['id'],d,start,bend):
            state='uncertain'; reason='Manager has not verified this entire time window'
        else:
            ov=overlap(c,t['id'],start,bend)
            if ov:
                state='held' if ov[0]=='hold' else 'occupied'
                reason='Protected manager hold' if ov[0]=='hold' else 'Conflicts with an existing commitment'
            else:
                state='available'; reason='Verified free capacity'
        res.append({**t,'state':state,'reason':reason})
    return res


@APP.get('/api/bootstrap')
def bootstrap(date: str | None = None, authorization: str | None = Header(None)):
    user=auth(authorization)
    d=date or local_date()
    dt_utc(d,'17:00')
    with db() as c:
        venue=dict(c.execute('SELECT * FROM venue LIMIT 1').fetchone())
        inc=incident(c,d)
        tabs=[dict(t) for t in c.execute('SELECT * FROM venue_tables ORDER BY id')]
        books=[booking_dict(b) for b in c.execute('SELECT * FROM bookings WHERE service_date=? ORDER BY starts_utc,id',(d,))]
        confs=[dict(r) for r in c.execute('''SELECT c.*,b.guest_name FROM conflicts c LEFT JOIN bookings b ON b.id=c.booking_id WHERE c.incident_id=? ORDER BY CASE WHEN c.state='open' THEN 0 ELSE 1 END,c.id DESC''',((inc['id'] if inc else -1),))]
        events=[dict(r) for r in c.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 70')]
        imps=[dict(r) for r in c.execute('SELECT * FROM imports WHERE incident_id=? ORDER BY id DESC',((inc['id'] if inc else -1),))]
        reconciliations=[dict(r) for r in c.execute('SELECT * FROM reconciliations WHERE incident_id=? ORDER BY id DESC',((inc['id'] if inc else -1),))]
        holds=[dict(r) for r in c.execute('SELECT h.*,t.label FROM holds h JOIN venue_tables t ON h.table_id=t.id WHERE service_date=?',(d,))]
        vers=[dict(r) for r in c.execute('SELECT * FROM verifications WHERE service_date=?',(d,))]
    for h in holds:
        h['time']=local(h['starts_utc'])[11:]; h['end_time']=local(h['ends_utc'])[11:]
    return {'venue':venue,'user':user,'date':d,'incident':dict(inc) if inc else None,
            'tables':tabs,'bookings':books,'conflicts':confs,'events':events,'imports':imps,'reconciliations':reconciliations,'holds':holds,'verifications':vers,
            'demo_notice':'Fictional demonstration data. No Resy integration or live availability.'}


class StartIncident(BaseModel):
    date: str
    reason: str = Field(min_length=5, max_length=300)


@APP.post('/api/incident/start')
def start_incident(p:StartIncident, authorization: str|None=Header(None)):
    user=auth(authorization,['manager']); dt_utc(p.date,'17:00')
    with tx() as c:
        inc=incident(c,p.date)
        if inc and inc['state']=='active':
            return {'id':inc['id'],'state':'active','already_active':True}
        c.execute('INSERT INTO incidents(service_date,state,reason,started_at,started_by) VALUES(?,?,?,?,?)',
                  (p.date,'active',p.reason,now(),user['display_name']))
        id=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        audit(c,user['username'],'incident_activated','incident',id,p.reason)
    return {'id':id,'state':'active'}


class VerifyTable(BaseModel):
    date: str
    table_id: int
    start_time: str='17:00'
    end_time: str='23:00'
    note: str=Field(min_length=8,max_length=300)


@APP.post('/api/tables/verify')
def verify_table(p: VerifyTable, authorization: str|None=Header(None)):
    user=auth(authorization,['manager'])
    start,end=dt_utc(p.date,p.start_time),dt_utc(p.date,p.end_time)
    if end<=start: raise HTTPException(422,'Verification end must follow start.')
    with tx() as c:
        if not c.execute('SELECT 1 FROM venue_tables WHERE id=? AND active=1',(p.table_id,)).fetchone(): raise HTTPException(404,'Table not found')
        inc=incident(c,p.date)
        if not inc or inc['state']!='active':raise HTTPException(409,'Activate Continuity Mode first.')
        c.execute('INSERT OR IGNORE INTO verifications(table_id,service_date,starts_utc,ends_utc,verified_by,verified_at) VALUES(?,?,?,?,?,?)',
                  (p.table_id,p.date,start,end,user['display_name'],now()))
        audit(c,user['username'],'table_verified','table',p.table_id,p.note)
    return {'ok':True}


class Hold(BaseModel):
    date: str
    table_id: int
    start_time: str
    end_time: str
    reason: str=Field(min_length=5,max_length=300)


@APP.post('/api/holds')
def create_hold(p:Hold,authorization: str|None=Header(None)):
    user=auth(authorization,['manager']); start,end=dt_utc(p.date,p.start_time),dt_utc(p.date,p.end_time)
    if end<=start:raise HTTPException(422,'End must follow start.')
    with tx() as c:
        if not c.execute('SELECT 1 FROM venue_tables WHERE id=?',(p.table_id,)).fetchone():raise HTTPException(404,'Table not found')
        if overlap(c,p.table_id,start,end):raise HTTPException(409,'Table already committed or protected for that window.')
        c.execute('INSERT INTO holds(table_id,service_date,starts_utc,ends_utc,reason,created_by,created_at) VALUES(?,?,?,?,?,?,?)',
                  (p.table_id,p.date,start,end,p.reason,user['username'],now()))
        hid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        audit(c,user['username'],'hold_created','hold',hid,p.reason)
    return {'id':hid}


@APP.delete('/api/holds/{hold_id}')
def remove_hold(hold_id:int,authorization: str|None=Header(None)):
    user=auth(authorization,['manager'])
    with tx() as c:
        hold=c.execute('SELECT * FROM holds WHERE id=?',(hold_id,)).fetchone()
        if not hold:raise HTTPException(404,'Hold not found')
        c.execute('DELETE FROM holds WHERE id=?',(hold_id,))
        audit(c,user['username'],'hold_removed','hold',hold_id,'Manager released protected inventory')
    return {'ok':True}


@APP.get('/api/availability')
def availability(date:str,time:str,party_size:int,authorization: str|None=Header(None)):
    auth(authorization)
    if party_size<1 or party_size>14:raise HTTPException(422,'Party size must be 1–14.')
    with db() as c:
        inc=incident(c,date)
        result=candidates(c,date,time,party_size)
    return {'date':date,'time':time,'party_size':party_size,
            'incident_active':bool(inc and inc['state']=='active'),'duration':90 if party_size<=2 else 120,
            'tables':result}


class CreateBooking(BaseModel):
    date: str
    time: str
    guest_name: str=Field(min_length=2,max_length=120)
    phone: str=''
    party_size: int=Field(ge=1,le=14)
    table_id: int|None=None
    note: str=''
    confirm: bool=True
    idempotency_key: str=Field(min_length=8,max_length=140)


@APP.post('/api/reservations')
def create_booking(p:CreateBooking,authorization: str|None=Header(None)):
    user=auth(authorization)
    start=dt_utc(p.date,p.time); duration=90 if p.party_size<=2 else 120
    end=plus(start,duration); bend=plus(end,BUFFER)
    if len(p.phone)>80 or len(p.note)>500:raise HTTPException(422,'Contact/notes too long.')
    with tx() as c:
        existing=c.execute('SELECT * FROM bookings WHERE idempotency_key=?',(p.idempotency_key,)).fetchone()
        if existing:return {'booking':booking_dict(existing),'replayed':True}
        inc=incident(c,p.date)
        if not inc or inc['state']!='active':raise HTTPException(409,'No active incident for this service date.')
        state='confirmed' if p.confirm else 'requested'
        assigned=p.table_id if p.confirm else None
        code='RCM-'+secrets.token_hex(3).upper() if p.confirm else None
        if p.confirm:
            if assigned is None: raise HTTPException(422,'Select a verified table before confirming.')
            t=c.execute('SELECT * FROM venue_tables WHERE id=? AND active=1',(assigned,)).fetchone()
            if not t or t['seats']<p.party_size:raise HTTPException(409,'Selected table cannot fit this party.')
            if not verify_for(c,assigned,p.date,start,bend):raise HTTPException(409,'Inventory uncertain. Manager must verify the full slot first.')
            ov=overlap(c,assigned,start,bend)
            if ov:raise HTTPException(409,'Table collision detected. Select another verified table/time.')
        c.execute('''INSERT INTO bookings(incident_id,service_date,guest_name,phone,party_size,starts_utc,ends_utc,block_ends_utc,table_id,source,state,verification,confirmation_code,note,idempotency_key,created_by,created_at,updated_at)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                  (inc['id'],p.date,p.guest_name.strip(),p.phone.strip(),p.party_size,start,end,bend,assigned,'Phone / walk-in',state,
                   'verified' if p.confirm else 'unverified',code,p.note.strip(),p.idempotency_key,user['username'],now(),now()))
        bid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        audit(c,user['username'],'booking_confirmed' if p.confirm else 'booking_requested','booking',bid,
              f'Table {assigned or "pending"}, party {p.party_size}, {p.date} {p.time}')
        row=c.execute('SELECT * FROM bookings WHERE id=?',(bid,)).fetchone()
    return {'booking':booking_dict(row),'replayed':False}


class GuestClaim(BaseModel):
    date: str
    time: str
    guest_name: str=Field(min_length=2,max_length=120)
    party_size: int=Field(ge=1,le=14)
    phone: str=''
    evidence: str=Field(min_length=5,max_length=500)


@APP.post('/api/claims')
def guest_claim(p:GuestClaim,authorization: str|None=Header(None)):
    user=auth(authorization); start=dt_utc(p.date,p.time); end=plus(start,90 if p.party_size<=2 else 120)
    with tx() as c:
        inc=incident(c,p.date)
        if not inc or inc['state']!='active':raise HTTPException(409,'Activate incident first')
        c.execute('''INSERT INTO bookings(incident_id,service_date,guest_name,phone,party_size,starts_utc,ends_utc,block_ends_utc,table_id,source,state,verification,note,created_by,created_at,updated_at)
                     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                  (inc['id'],p.date,p.guest_name.strip(),p.phone,p.party_size,start,end,plus(end,BUFFER),None,'Guest-provided claim','imported_unverified','unverified',p.evidence,user['username'],now(),now()))
        bid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        c.execute('INSERT INTO conflicts(incident_id,booking_id,kind,severity,description,created_at) VALUES(?,?,?,?,?,?)',
                  (inc['id'],bid,'missing_guest','high','Guest claims a pre-existing reservation; requires evidence review and inventory protection.',now()))
        audit(c,user['username'],'guest_claim_recorded','booking',bid,'Unverified guest claim; no booking automatically confirmed')
    return {'id':bid,'state':'imported_unverified'}


ALLOWED={
    'imported_unverified':{'verified_existing','cancelled'},
    'verified_existing':{'checked_in','cancelled','no_show'},
    'requested':{'pending_verification','cancelled'},
    'pending_verification':{'cancelled'},
    'confirmed':{'checked_in','cancelled','no_show'},
    'checked_in':{'seated','cancelled'},
    'seated':{'completed'},
    'completed':set(), 'cancelled':set(), 'no_show':set()
}


class ChangeState(BaseModel):
    state: str
    version: int
    reason: str='Status updated at host stand'


@APP.patch('/api/reservations/{booking_id}/state')
def change_state(booking_id:int,p:ChangeState,authorization:str|None=Header(None)):
    user=auth(authorization)
    with tx() as c:
        b=c.execute('SELECT * FROM bookings WHERE id=?',(booking_id,)).fetchone()
        if not b:raise HTTPException(404,'Reservation not found')
        if p.version!=b['version']:raise HTTPException(409,'Stale view. Refresh and retry.')
        if p.state not in ALLOWED.get(b['state'],set()):raise HTTPException(409,f"Cannot change {b['state']} to {p.state}.")
        if p.state=='verified_existing':
            if user['role']!='manager':raise HTTPException(403,'Manager verification required.')
            if not b['table_id']:raise HTTPException(409,'Assign and protect table capacity before verification.')
            if overlap(c,b['table_id'],b['starts_utc'],b['block_ends_utc'],b['id']):raise HTTPException(409,'Table conflicts with another commitment.')
        c.execute('UPDATE bookings SET state=?,verification=?,version=version+1,updated_at=? WHERE id=?',
                  (p.state,'verified' if p.state=='verified_existing' else b['verification'],now(),booking_id))
        audit(c,user['username'],'state_changed','booking',booking_id,f"{b['state']} → {p.state}; {p.reason[:150]}")
    return {'ok':True,'new_state':p.state}


class AssignTable(BaseModel):
    table_id: int
    version: int
    reason: str=Field(min_length=5,max_length=300)


@APP.patch('/api/reservations/{booking_id}/assign')
def assign_table(booking_id:int,p:AssignTable,authorization:str|None=Header(None)):
    user=auth(authorization,['manager'])
    with tx() as c:
        b=c.execute('SELECT * FROM bookings WHERE id=?',(booking_id,)).fetchone()
        if not b:raise HTTPException(404,'Reservation not found')
        if b['version']!=p.version:raise HTTPException(409,'Stale view; reload.')
        if b['state'] not in ['imported_unverified','verified_existing']:raise HTTPException(409,'Only existing reservations can be assigned through this workflow.')
        t=c.execute('SELECT * FROM venue_tables WHERE id=?',(p.table_id,)).fetchone()
        if not t or t['seats']<b['party_size']:raise HTTPException(409,'Table insufficient for party size.')
        if overlap(c,p.table_id,b['starts_utc'],b['block_ends_utc'],b['id']):raise HTTPException(409,'Existing booking or protective hold overlaps. Resolve first.')
        c.execute('UPDATE bookings SET table_id=?,version=version+1,updated_at=? WHERE id=?',(p.table_id,now(),booking_id))
        audit(c,user['username'],'existing_table_assigned','booking',booking_id,f'Table {p.table_id}; {p.reason}')
    return {'ok':True}


class ResolveConflict(BaseModel):
    resolution: str=Field(min_length=10,max_length=500)


@APP.post('/api/conflicts/{conflict_id}/resolve')
def resolve_conflict(conflict_id:int,p:ResolveConflict,authorization:str|None=Header(None)):
    user=auth(authorization,['manager'])
    with tx() as c:
        f=c.execute('SELECT * FROM conflicts WHERE id=?',(conflict_id,)).fetchone()
        if not f:raise HTTPException(404,'Conflict not found')
        if f['state']=='resolved':return {'ok':True,'already_resolved':True}
        # Guest reservation remains separately unverified unless explicitly handled.
        c.execute("UPDATE conflicts SET state='resolved',resolution=?,resolved_by=?,resolved_at=? WHERE id=?",
                  (p.resolution,user['username'],now(),conflict_id))
        audit(c,user['username'],'conflict_resolved','conflict',conflict_id,p.resolution)
    return {'ok':True}


REQUIRED=['guest_name','party_size','date','time']


def parse_csv(raw):
    if len(raw)>1_000_000:raise HTTPException(413,'Maximum import size is 1 MB.')
    try:
        reader=csv.DictReader(io.StringIO(raw.lstrip('\ufeff'),newline=''))
        if not reader.fieldnames:raise HTTPException(422,'CSV header missing.')
        fields=[str(x).strip().lower() for x in reader.fieldnames]
        missing=[h for h in REQUIRED if h not in fields]
        if missing:raise HTTPException(422,'CSV missing columns: '+', '.join(missing))
        output=[]
        for i,row in enumerate(reader,2):
            item={k.strip().lower(): (v or '').strip() for k,v in row.items() if k is not None}
            errors=[]
            try:
                d=item.get('date',''); t=item.get('time','')
                dt_utc(d,t)
            except HTTPException:errors.append('Invalid date/time (YYYY-MM-DD, HH:MM)')
            try:
                party=int(item.get('party_size',0))
                if party<1 or party>14:raise ValueError()
            except ValueError:
                party=0; errors.append('Party size must be 1–14')
            if len(item.get('guest_name',''))<2:errors.append('Missing guest name')
            if len(item.get('guest_name',''))>120:errors.append('Name too long')
            item['party_size']=party
            output.append({'row':i,'data':item,'errors':errors,'status':'invalid' if errors else 'ready'})
            if len(output)>500:raise HTTPException(413,'Maximum 500 rows per import')
        return output
    except csv.Error:
        raise HTTPException(422,'Malformed CSV.')


class ImportPayload(BaseModel):
    csv_text: str
    source_as_of: str=Field(min_length=5,max_length=120)
    origin: str='Approved restaurant backup CSV'


@APP.post('/api/imports/preview')
def preview_import(p:ImportPayload,authorization:str|None=Header(None)):
    auth(authorization)
    records=parse_csv(p.csv_text)
    with db() as c:
        for row in records:
            if row['errors']:continue
            b=row['data'];start=dt_utc(b['date'],b['time'])
            dup=c.execute('''SELECT id FROM bookings WHERE service_date=? AND lower(guest_name)=lower(?) AND starts_utc=?''',
                          (b['date'],b['guest_name'],start)).fetchone()
            if dup:
                row['status']='duplicate';row['errors'].append('Likely duplicate of ledger #'+str(dup['id']))
            label=b.get('table','')
            if label and not c.execute('SELECT id FROM venue_tables WHERE label=?',(label,)).fetchone():
                row['status']='invalid';row['errors'].append('Unknown table label: '+label)
    seen=set()
    for row in records:
        b=row['data']; key=(b.get('guest_name','').lower(),b.get('date'),b.get('time'))
        if key in seen and row['status']=='ready':
            row['status']='duplicate';row['errors'].append('Duplicate within uploaded CSV')
        seen.add(key)
    return {'rows':records,'ready':sum(r['status']=='ready' for r in records),'flagged':sum(r['status']!='ready' for r in records)}


@APP.post('/api/imports/commit')
def commit_import(p:ImportPayload,authorization:str|None=Header(None)):
    user=auth(authorization)
    pre=preview_import(p,authorization)
    saved=0; rejected=0
    with tx() as c:
        c.execute('INSERT INTO imports(incident_id,origin,source_as_of,rows_ok,rows_rejected,created_by,created_at) VALUES(NULL,?,?,0,0,?,?)',
                  (p.origin,p.source_as_of,user['username'],now()))
        import_id=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        for row in pre['rows']:
            if row['status']!='ready':rejected+=1;continue
            b=row['data'];inc=incident(c,b['date'])
            if not inc or inc['state']!='active':rejected+=1;continue
            start=dt_utc(b['date'],b['time']);end=plus(start,90 if b['party_size']<=2 else 120)
            if c.execute('''SELECT id FROM bookings WHERE service_date=? AND lower(guest_name)=lower(?) AND starts_utc=?''',
                         (b['date'],b['guest_name'],start)).fetchone():rejected+=1;continue
            table_id=None;flag=None
            if b.get('table'):
                table=c.execute('SELECT * FROM venue_tables WHERE label=?',(b['table'],)).fetchone()
                if table and table['seats']>=b['party_size'] and not overlap(c,table['id'],start,plus(end,BUFFER)):
                    table_id=table['id']
                else: flag='Table overlap/capacity issue; original table is not trusted'
            state='imported_unverified'
            c.execute('''INSERT INTO bookings(incident_id,service_date,guest_name,phone,party_size,starts_utc,ends_utc,block_ends_utc,table_id,source,state,verification,note,created_by,created_at,updated_at)
                         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                      (inc['id'],b['date'],b['guest_name'],b.get('phone',''),b['party_size'],start,end,plus(end,BUFFER),table_id,
                       p.origin,state,'unverified','Imported: requires independent evidence review',user['username'],now(),now()))
            bid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
            if not table_id:
                c.execute('INSERT INTO conflicts(incident_id,booking_id,kind,severity,description,created_at) VALUES(?,?,?,?,?,?)',
                          (inc['id'],bid,'unassigned_existing','high',flag or 'Imported booking has no assigned table; protect inventory and verify.',now()))
            saved+=1
            c.execute('UPDATE imports SET incident_id=? WHERE id=?',(inc['id'],import_id))
        c.execute('UPDATE imports SET rows_ok=?,rows_rejected=? WHERE id=?',(saved,rejected,import_id))
        audit(c,user['username'],'import_committed','import',import_id,f'Accepted {saved}, flagged/rejected {rejected}; source as of {p.source_as_of}')
    return {'import_id':import_id,'accepted':saved,'rejected':rejected}


class ReconcileRequest(BaseModel):
    date: str
    csv_text: str


@APP.post('/api/reconcile/preview')
def reconcile(p:ReconcileRequest,authorization:str|None=Header(None)):
    user=auth(authorization,['manager']);rows=parse_csv(p.csv_text)
    with db() as c:
        ours=[booking_dict(b) for b in c.execute('SELECT * FROM bookings WHERE service_date=?',(p.date,))]
    provider=[r['data'] for r in rows if r['status']=='ready' and r['data']['date']==p.date]
    a={(b['guest_name'].lower(),b['date'],b['time']):b for b in ours if b['state']!='cancelled'}
    b={(x['guest_name'].lower(),x['date'],x['time']):x for x in provider}
    matches=[]; provider_only=[]; local_only=[]; changed=[]
    for key,record in b.items():
        if key in a:
            if record['party_size']!=a[key]['party_size']:
                changed.append({'guest_name':record['guest_name'],'time':record['time'],'local_party':a[key]['party_size'],'provider_party':record['party_size']})
            else:matches.append({'guest_name':record['guest_name'],'time':record['time']})
        else:provider_only.append({'guest_name':record['guest_name'],'time':record['time'],'party_size':record['party_size']})
    for key,record in a.items():
        if key not in b:local_only.append({'guest_name':record['guest_name'],'time':record['time'],'party_size':record['party_size'],'state':record['state']})
    invalid=[r for r in rows if r['status']!='ready']
    with tx() as c:
        inc=incident(c,p.date)
        if not inc or inc['state']!='active':raise HTTPException(409,'Reconciliation requires an active incident.')
        c.execute('INSERT INTO reconciliations(incident_id,uploaded_by,uploaded_at,matches,provider_only,local_only,changed,invalid_rows) VALUES(?,?,?,?,?,?,?,?)',
                  (inc['id'],user['username'],now(),len(matches),len(provider_only),len(local_only),len(changed),len(invalid)))
        rid=c.execute('SELECT last_insert_rowid()').fetchone()[0]
        audit(c,user['username'],'reconciliation_compared','incident',inc['id'],f'Comparison #{rid}: {len(matches)} exact, {len(provider_only)} provider-only, {len(local_only)} local-only, {len(changed)} changed')
    return {'comparison_id':rid,'matches':matches,'provider_only':provider_only,'local_only':local_only,'changed':changed,
            'invalid_rows':invalid, 'note':'Comparison recorded; investigate and resolve in provider manually. Never writes back.'}


class CloseIncident(BaseModel):
    date: str
    reason: str=Field(min_length=10,max_length=500)
    override: bool=False


@APP.post('/api/incident/close')
def close_incident(p:CloseIncident,authorization:str|None=Header(None)):
    user=auth(authorization,['manager'])
    with tx() as c:
        inc=incident(c,p.date)
        if not inc or inc['state']!='active':raise HTTPException(409,'No active incident.')
        count=c.execute("SELECT COUNT(*) FROM conflicts WHERE incident_id=? AND state='open'",(inc['id'],)).fetchone()[0]
        if count and not p.override:raise HTTPException(409,f'{count} unresolved conflicts. Resolve them or document a manager exception.')
        c.execute("UPDATE incidents SET state='closed',ended_at=?,signed_by=?,signed_reason=? WHERE id=?",
                  (now(),user['display_name'],('MANAGER OVERRIDE — ' if p.override and count else '')+p.reason,inc['id']))
        audit(c,user['username'],'incident_closed','incident',inc['id'],f'{count} open conflicts; {p.reason}')
    return {'ok':True,'open_conflicts_at_close':count}


@APP.get('/api/export/{kind}')
def export(kind:str,date:str,authorization:str|None=Header(None)):
    auth(authorization)
    if kind not in ['ledger','audit','reconciliation']:raise HTTPException(404,'Export unavailable')
    output=io.StringIO(newline='')
    with db() as c:
        if kind=='ledger':
            rows=[booking_dict(x) for x in c.execute('SELECT * FROM bookings WHERE service_date=? ORDER BY starts_utc',(date,))]
            cols=['id','date','time','guest_name','phone','party_size','table_id','state','verification','source','confirmation_code','note','version','created_by','created_at','updated_at']
        elif kind=='audit':
            rows=[dict(x) for x in c.execute('SELECT * FROM audit ORDER BY id')]
            cols=['id','actor','action','entity_type','entity_id','detail','created_at']
        else:
            inc=incident(c,date)
            if not inc:raise HTTPException(404,'No incident for date.')
            cols=['section','record_id','subject','state','detail','actor','timestamp']
            rows=[]
            for r in c.execute('SELECT id,guest_name,party_size,state,verification,source,created_by,updated_at FROM bookings WHERE incident_id=? ORDER BY id',(inc['id'],)):
                rows.append({'section':'booking','record_id':r['id'],'subject':r['guest_name'],'state':r['state'],
                             'detail':f"Party {r['party_size']} | Verification: {r['verification']} | Source: {r['source']}",'actor':r['created_by'],'timestamp':r['updated_at']})
            for r in c.execute('SELECT * FROM conflicts WHERE incident_id=? ORDER BY id',(inc['id'],)):
                rows.append({'section':'conflict','record_id':r['id'],'subject':r['kind'],'state':r['state'],
                             'detail':r['resolution'] or r['description'],'actor':r['resolved_by'] or '',
                             'timestamp':r['resolved_at'] or r['created_at']})
            for r in c.execute('SELECT * FROM reconciliations WHERE incident_id=? ORDER BY id',(inc['id'],)):
                rows.append({'section':'reconciliation_comparison','record_id':r['id'],'subject':'Restored-provider comparison',
                             'state':'review_required','detail':f"Exact {r['matches']}; provider only {r['provider_only']}; local only {r['local_only']}; changed {r['changed']}; invalid {r['invalid_rows']}",
                             'actor':r['uploaded_by'],'timestamp':r['uploaded_at']})
            rows.append({'section':'incident_signoff','record_id':inc['id'],'subject':date,'state':inc['state'],
                         'detail':inc['signed_reason'] or 'Not signed off','actor':inc['signed_by'] or '',
                         'timestamp':inc['ended_at'] or ''})
    w=csv.DictWriter(output,fieldnames=cols,extrasaction='ignore');w.writeheader();w.writerows(rows)
    return Response(content='\ufeff'+output.getvalue(),media_type='text/csv; charset=utf-8',
                    headers={'Content-Disposition':f'attachment; filename="rcm_{kind}_{date}.csv"'})
