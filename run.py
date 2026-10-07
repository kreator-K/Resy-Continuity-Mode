"""Run the local Restaurant Continuity Mode web application."""
import uvicorn
if __name__=='__main__':
    print('\nRestaurant Continuity Mode → http://127.0.0.1:8765')
    print('Demo login: manager / demo123! (or host / demo123!)\n')
    uvicorn.run('api:app',host='127.0.0.1',port=8765,reload=False)
