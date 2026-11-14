"""Offline check of the packaged catalog worker, including Cyrillic stdin/stdout."""
import subprocess,json,sys
payload={'id':'проверка','mode':'invalid','value':''}
r=subprocess.run([sys.argv[1],'--worker'],input=json.dumps(payload,ensure_ascii=False)+'\n',encoding='utf-8',capture_output=True,timeout=30,check=True)
reply=json.loads(r.stdout.strip());assert reply['id']==payload['id'];assert reply.get('error');print('Packaged worker UTF-8 protocol passed')
