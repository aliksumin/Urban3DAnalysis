const q = `[out:xml][timeout:90];(way["building"](40.70,-74.01,40.71,-74.00););(._;>;);out body;`;
fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'data=' + encodeURIComponent(q)
})
.then(r => r.text())
.then(t => console.log('WAYS:', t.match(/<way/g)?.length, 'NODES:', t.match(/<node/g)?.length, 'SIZE:', t.length))
.catch(e => console.error(e));
