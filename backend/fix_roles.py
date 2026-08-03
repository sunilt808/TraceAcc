import os
import re

routes_dir = os.path.join(os.path.dirname(__file__), 'api', 'routes')

for fname in os.listdir(routes_dir):
    if not fname.endswith('.py'):
        continue
    fpath = os.path.join(routes_dir, fname)
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Remove ", Role.SUPER_ADMIN.value" and "Role.SUPER_ADMIN.value, "
    content = content.replace(', Role.SUPER_ADMIN.value', '')
    content = content.replace('Role.SUPER_ADMIN.value, ', '')
    content = content.replace('Role.SUPER_ADMIN.value', 'Role.ADMIN.value')

    # Remove ", Role.AUDITOR.value" and "Role.AUDITOR.value, "
    content = content.replace(', Role.AUDITOR.value', '')
    content = content.replace('Role.AUDITOR.value, ', '')
    content = content.replace('Role.AUDITOR.value', 'Role.ADMIN.value')

    # Remove "SUPER_ADMIN" from comments (replace with ADMIN)
    content = content.replace('SUPER_ADMIN', 'ADMIN')

    # Fix duplicate Role.ADMIN.value entries in lists
    content = re.sub(r'Role\.ADMIN\.value,\s*Role\.ADMIN\.value', 'Role.ADMIN.value', content)

    if content != original:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed: {fname}')
    else:
        print(f'OK: {fname}')
