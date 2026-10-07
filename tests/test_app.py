"""Safety acceptance tests for local demo backend.
Run: python -m pytest -q tests
"""
import importlib
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def env(tmp_path,monkeypatch):
    monkeypatch.setenv('RCM_DB',str(tmp_path/'isolated.db'))
    if 'api' in sys.modules:
        del sys.modules['api']
    import api
    with TestClient(api.app) as client:
        manager=client.post('/api/login',json={'username':'manager','password':'demo123!'}).json()['token']
        host=client.post('/api/login',json={'username':'host','password':'demo123!'}).json()['token']
        headers={'Authorization':'Bearer '+manager}
        hosth={'Authorization':'Bearer '+host}
        d=datetime.now(ZoneInfo('America/New_York')).date().isoformat()
        yield client,api,d,headers,hosth


def test_existing_guest_and_audit(env):
    c,api,d,mgr,host=env
    r=c.get('/api/bootstrap',headers=mgr)
    assert r.status_code==200
    data=r.json()
    assert len(data['tables'])==14
    assert len(data['bookings'])==9
    assert data['incident']['state']=='active'
    assert any(x['state']=='imported_unverified' for x in data['bookings'])
    assert len(data['conflicts'])==1
    assert c.get('/api/bootstrap').status_code==401


def test_inventory_closed_until_verified_and_roles(env):
    c,api,d,mgr,host=env
    r=c.get('/api/availability',params={'date':d,'time':'18:00','party_size':2},headers=mgr)
    assert r.status_code==200
    states={x['label']:x['state'] for x in r.json()['tables']}
    assert states['P06']=='uncertain'
    assert states['T08']=='held'
    assert c.post('/api/tables/verify',headers=host,json={
        'date':d,'table_id':14,'note':'Manager verified clear capacity'}).status_code==403
    payload={'date':d,'time':'18:00','guest_name':'Test New Guest','party_size':2,'table_id':14,'confirm':True,'idempotency_key':'test-blocked-booking-key'}
    r=c.post('/api/reservations',headers=host,json=payload)
    assert r.status_code==409, r.text


def test_concurrent_conflict_only_one_succeeds(env):
    c,api,d,mgr,host=env
    # T01's earlier verified 17:30 booking is clear by 20:30; service window supports 90m+15m.
    p={'date':d,'time':'20:30','guest_name':'Concurrency Guest','party_size':2,'table_id':1,'confirm':True,'phone':'', 'note':''}
    def book(n):
        return c.post('/api/reservations',headers=host,json={**p,'idempotency_key':f'unique-concurrent-request-{n}'})
    with ThreadPoolExecutor(max_workers=2) as ex:
        r1,r2=list(ex.map(book,[1,2]))
    assert sorted([r1.status_code,r2.status_code])==[200,409],(r1.text,r2.text)
    winning=r1 if r1.status_code==200 else r2
    key='unique-concurrent-request-'+('1' if r1.status_code==200 else '2')
    again=c.post('/api/reservations',headers=host,json={**p,'idempotency_key':key})
    assert again.status_code==200
    assert again.json()['replayed'] is True
    assert again.json()['booking']['id']==winning.json()['booking']['id']


def test_import_is_unverified_and_collision_is_flagged(env):
    c,api,d,mgr,host=env
    raw=f'guest_name,party_size,date,time,table,phone\nUna Example,2,{d},21:00,P01,\nAvery Chen,2,{d},17:30,T01,\n'
    p={'csv_text':raw,'source_as_of':f'{d} 14:00','origin':'Test approved backup'}
    preview=c.post('/api/imports/preview',headers=host,json=p)
    assert preview.status_code==200
    assert preview.json()['ready']==1
    assert preview.json()['flagged']==1
    r=c.post('/api/imports/commit',headers=host,json=p)
    assert r.status_code==200,r.text
    assert r.json()['accepted']==1 and r.json()['rejected']==1
    b=[b for b in c.get('/api/bootstrap',headers=mgr).json()['bookings'] if b['guest_name']=='Una Example'][0]
    assert b['state']=='imported_unverified' and b['verification']=='unverified'


def test_missing_claim_and_manager_closeout(env):
    c,api,d,mgr,host=env
    claim=c.post('/api/claims',headers=host,json={'date':d,'time':'20:00','guest_name':'Unlisted Guest','party_size':2,'evidence':'Guest displayed confirmation on phone.'})
    assert claim.status_code==200
    assert claim.json()['state']=='imported_unverified'
    assert c.post('/api/incident/close',headers=host,json={'date':d,'reason':'Everything has been checked.'}).status_code==403
    assert c.post('/api/incident/close',headers=mgr,json={'date':d,'reason':'Everything has been checked.'}).status_code==409
    closed=c.post('/api/incident/close',headers=mgr,json={'date':d,'reason':'Manager reviewed pending discrepancies and documented exception.','override':True})
    assert closed.status_code==200
    assert closed.json()['open_conflicts_at_close']>=1


def test_exports_and_reconcile_preview(env):
    c,api,d,mgr,host=env
    export=c.get('/api/export/ledger',headers=host,params={'date':d})
    assert export.status_code==200
    assert export.content.startswith(b'\xef\xbb\xbf')
    assert b'Avery Chen' in export.content
    raw=f'guest_name,party_size,date,time,table\nAvery Chen,2,{d},17:30,T01\nExternal Guest,4,{d},20:30,T04\n'
    data=c.post('/api/reconcile/preview',headers=mgr,json={'date':d,'csv_text':raw})
    assert data.status_code==200, data.text
    results=data.json()
    assert len(results['matches'])==1
    assert len(results['provider_only'])==1
    assert len(results['local_only'])>=1
    report=c.get('/api/export/reconciliation',headers=mgr,params={'date':d})
    assert report.status_code==200
    assert b'reconciliation_comparison' in report.content
    assert b'incident_signoff' in report.content
