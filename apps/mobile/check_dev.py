#!/usr/bin/env python3
import os
for root, dirs, files in os.walk('/tmp/dev-bundle-verify'):
    for f in files:
        if f.endswith('.js') or f.endswith('.bundle'):
            path = os.path.join(root, f)
            print(f"Checking: {path}, size={os.path.getsize(path)}")
            with open(path, 'rb') as fh:
                content = fh.read()
            idx = content.find(b'tabBarLabel:')
            if idx >= 0:
                start = max(0, idx - 50)
                end = min(len(content), idx + 300)
                print(f"=== Found at byte {idx} ===")
                print(content[start:end].decode('utf-8', errors='replace'))
