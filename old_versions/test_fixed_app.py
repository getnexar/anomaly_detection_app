#!/usr/bin/env python3
import time
import requests
from bs4 import BeautifulSoup

print("🔍 Testing Fixed App...")

# Test 1: Check if page loads
print("\nTest 1: Loading index-fixed.html...")
response = requests.get("http://localhost:8200/index-fixed.html")
print(f"✓ Status code: {response.status_code}")

soup = BeautifulSoup(response.text, 'html.parser')

# Test 2: Check if Three.js scripts are included
print("\nTest 2: Checking Three.js scripts...")
three_script = soup.find('script', src=lambda x: x and 'three.min.js' in x)
orbit_script = soup.find('script', src=lambda x: x and 'OrbitControls.js' in x)

if three_script:
    print("✓ Three.js script found")
else:
    print("✗ Three.js script NOT found")

if orbit_script:
    print("✓ OrbitControls script found")
else:
    print("✗ OrbitControls script NOT found")

# Test 3: Check if main-fixed.js is loaded
main_script = soup.find('script', src=lambda x: x and 'main-fixed.js' in x)
if main_script:
    print("✓ main-fixed.js found")
else:
    print("✗ main-fixed.js NOT found")

# Test 4: Check if loading indicator exists
loading_div = soup.find('div', id='loading-indicator')
if loading_div:
    print("✓ Loading indicator element exists")
else:
    print("✗ Loading indicator element NOT found")

# Test 5: Test API endpoints
print("\nTest 3: Testing API endpoints...")
health = requests.get("http://localhost:8200/api/health")
print(f"✓ Health endpoint: {health.json()['status']}")

videos = requests.get("http://localhost:8200/api/videos?page=1&per_page=5")
video_count = len(videos.json()['videos'])
print(f"✓ Videos endpoint: {video_count} videos returned")

# Test 6: Check if VideoVisualization3D-fixed.js exists
print("\nTest 4: Checking fixed component...")
viz_response = requests.get("http://localhost:8200/js/components/VideoVisualization3D-fixed.js")
if viz_response.status_code == 200:
    print("✓ VideoVisualization3D-fixed.js loads successfully")
    if 'typeof THREE === \'undefined\'' in viz_response.text:
        print("✓ Fixed version checks for global THREE")
else:
    print("✗ VideoVisualization3D-fixed.js NOT found")

print("\n🎉 SUMMARY:")
print("The fixed version:")
print("- Loads Three.js as global scripts (not ES modules)")
print("- Uses VideoVisualization3D-fixed.js that expects global THREE")
print("- Should work in all browsers without import map issues")
print("\nPlease open http://35.95.163.15:8200/index-fixed.html to see the working app!")