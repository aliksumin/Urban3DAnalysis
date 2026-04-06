fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: 'data=' + encodeURIComponent('[out:xml][timeout:90];(way["building"](40.70,-74.01,40.71,-74.00););(._;>;);out body;')
}).then(r=>r.text()).then(t=>console.log(t.substring(0, 500))).catch(e=>console.error(e));
