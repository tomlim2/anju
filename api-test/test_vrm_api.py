import requests
import json
import os
from datetime import datetime

# API 엔드포인트
url = ''

# 헤더 설정
headers = {
    'Authorization': '',  # TODO: 실제 토큰으로 교체 필요
    'Content-Type': 'application/json'
}

# 요청 데이터
data = {
    'zepetoId': 'crepusculo_90'
    # 'hashcode': 'GUNLEE',  # 선택적 파라미터
    # 'metadata': {}  # 선택적 파라미터
}

# 요청 실행
try:
    print("Sending POST request to:", url)
    print("Headers:", json.dumps(headers, indent=2))
    print("Data:", json.dumps(data, indent=2))
    print("\n" + "="*50 + "\n")

    response = requests.post(url, headers=headers, json=data, timeout=60)

    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print("\nResponse Body:")

    response_data = response.json()
    print(json.dumps(response_data, indent=2, ensure_ascii=False))

    # VRM 파일 다운로드
    if response.status_code == 200 and 'url' in response_data:
        vrm_url = response_data['url']
        zepeto_id = data['zepetoId']
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{zepeto_id}_{timestamp}.vrm"

        print(f"\n" + "="*50)
        print(f"Downloading VRM file from: {vrm_url}")
        print(f"Saving as: {filename}")

        download_response = requests.get(vrm_url, timeout=60)

        if download_response.status_code == 200:
            with open(filename, 'wb') as f:
                f.write(download_response.content)

            file_size = os.path.getsize(filename)
            print(f"Download complete! File size: {file_size:,} bytes ({file_size/1024/1024:.2f} MB)")
        else:
            print(f"Download failed with status code: {download_response.status_code}")

except requests.exceptions.RequestException as e:
    print(f"Error occurred: {e}")
