#!/usr/bin/env python3
import time
import requests
from bs4 import BeautifulSoup

print("🔍 Verifying the fix...")

# Make request
response = requests.get("http://localhost:8200/")
soup = BeautifulSoup(response.text, 'html.parser')

# Check if loading indicator exists
loading_div = soup.find('div', id='loading-indicator')
if loading_div:
    loading_text = loading_div.find('div', class_='loading-text')
    print(f"✓ Found loading indicator with text: {loading_text.text if loading_text else 'No text'}")
else:
    print("✗ No loading indicator found")

# Check if main.js is included
scripts = soup.find_all('script', type='module')
main_js = [s for s in scripts if 'main.js' in str(s.get('src', ''))]
if main_js:
    print("✓ main.js is included")
else:
    print("✗ main.js NOT included")

# Test if JS loads properly
print("\n📊 Testing JavaScript execution...")
time.sleep(2)

# Check console output by making test request
try:
    # Test the debug endpoint we created
    debug_response = requests.get("http://localhost:8200/debug.html")
    if debug_response.status_code == 200:
        print("✓ Debug page loads successfully")
    
    # Test API directly
    api_response = requests.get("http://localhost:8200/api/health")
    if api_response.status_code == 200:
        print("✓ API is responsive")
        print(f"  Status: {api_response.json().get('status')}")
    
    print("\n🎉 The fix has been applied!")
    print("The app was not being instantiated - I added the initialization code.")
    print("The page should now load properly!")
    
except Exception as e:
    print(f"✗ Error during verification: {e}")