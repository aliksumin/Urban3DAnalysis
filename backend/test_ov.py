import overturemaps
import json

bbox = (-71.068, 42.353, -71.058, 42.363)
try:
    gdf = overturemaps.core.record_store("place").get_bbox(bbox) # wait I don't know the api
    print(gdf)
except Exception as e:
    print("Error:", e)

    try:
        # overturemaps download --bbox=-71.068,42.353,-71.058,42.363 -f geojson --type=place
        import subprocess
        res = subprocess.run(["uv", "run", "overturemaps", "download", "--bbox", "-71.068,42.353,-71.058,42.363", "-f", "geojson", "--type", "place"], capture_output=True, text=True)
        print("subprocess result:", res.stdout[:500])
    except Exception as e2:
        print("Error2:", e2)
