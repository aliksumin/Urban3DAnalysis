import numpy as np
from PIL import Image

def analyze(name):
    img = np.array(Image.open(name+'.png'))
    top = img[150:200, 200:300].mean()
    bot = img[300:350, 200:300].mean()
    left = img[200:300, 150:200].mean()
    right = img[200:300, 300:350].mean()
    print(f'{name} -> T:{top:.0f} B:{bot:.0f} L:{left:.0f} R:{right:.0f}')
    
    # check if there's a strong wake (one side is significantly darker)
    arr = [top, bot, left, right]
    if max(arr) - min(arr) > 10:
        print(f"  --> valid wake found!")
        
analyze('geo_0')
analyze('geo_1')
analyze('geo_2')
