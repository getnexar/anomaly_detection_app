#!/usr/bin/env python3
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Set up headless Chrome
options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

print("🔍 Testing app loading...")

try:
    driver = webdriver.Chrome(options=options)
    driver.get("http://localhost:8200")
    
    print("📄 Page loaded, waiting for content...")
    
    # Wait up to 30 seconds for loading to disappear
    wait = WebDriverWait(driver, 30)
    
    # Get console logs
    time.sleep(5)  # Give it time to load
    logs = driver.get_log('browser')
    
    print("\n📋 Console logs:")
    for log in logs:
        print(f"  [{log['level']}] {log['message']}")
    
    # Check if loading message is still visible
    loading_elements = driver.find_elements(By.CLASS_NAME, "loading-message")
    if loading_elements and loading_elements[0].is_displayed():
        print("\n❌ LOADING STILL VISIBLE!")
        print(f"   Text: {loading_elements[0].text}")
    else:
        print("\n✅ Loading disappeared - app loaded!")
    
    # Get page source snippet
    print("\n📄 Page state:")
    body_text = driver.find_element(By.TAG_NAME, "body").text[:500]
    print(body_text)
    
except Exception as e:
    print(f"❌ Error: {e}")
finally:
    if 'driver' in locals():
        driver.quit()