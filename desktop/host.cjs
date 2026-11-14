// Production entry: bind only inside the private container network; Caddy publishes HTTPS.
const {serve}=require('./server.cjs');
serve(Number(process.env.PORT)||8765,{host:process.env.MUSIC_BIND||'127.0.0.1'}).then(server=>{console.log('veyw server ready');const stop=()=>{server.close(()=>process.exit());require('./catalog.cjs').stop();setTimeout(()=>process.exit(),5000).unref();};process.on('SIGTERM',stop);process.on('SIGINT',stop);}).catch(e=>{console.error(e.message);process.exitCode=1;});
