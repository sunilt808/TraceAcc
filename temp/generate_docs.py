import os
import shutil
import markdown

TEMP_DIR = r"d:\rift\temp"
DOCS_DIR = r"d:\rift\docs"
HTML_DIR = os.path.join(DOCS_DIR, "html")

os.makedirs(DOCS_DIR, exist_ok=True)
os.makedirs(HTML_DIR, exist_ok=True)

# 1. Move existing files
existing_files = os.listdir(TEMP_DIR)
for file in existing_files:
    if file.endswith(".md"):
        shutil.move(os.path.join(TEMP_DIR, file), os.path.join(DOCS_DIR, file))

# 2. List of all required files (27 total)
required_files = [
    "README.md", "PROJECT_STATUS.md", "ARCHITECTURE.md", "DATABASE.md", 
    "API_DOCUMENTATION.md", "DETECTION_ENGINE.md", "SECURITY_REVIEW.md", 
    "PROJECT_ROADMAP.md", "PRODUCTION_REVIEW.md", "INTERVIEW_GUIDE.md", 
    "CHANGELOG.md", "TODO.md", "UPGRADE_GUIDE.md", "INSTALLATION.md", 
    "DEPLOYMENT.md", "TESTING.md", "PERFORMANCE.md", "BENCHMARK.md", 
    "USER_MANUAL.md", "DEVELOPER_GUIDE.md", "LIMITATIONS.md", "FUTURE_SCOPE.md", 
    "RESEARCH.md", "REFERENCES.md", "PRESENTATION.md", "TROUBLESHOOTING.md", 
    "API_SCHEMA.md"
]

# 3. Create missing files with basic templates
for file in required_files:
    path = os.path.join(DOCS_DIR, file)
    if not os.path.exists(path):
        with open(path, "w", encoding="utf-8") as f:
            f.write(f"# {file.replace('.md', '').replace('_', ' ').title()}\n\nThis document is part of the comprehensive documentation suite for the Graph-Based Financial Crime Detection Platform.\n\n## Overview\nDetailed contents will be populated during the final technical writing phase.")

# 4. Generate HTML versions for specific files
html_files = [
    "presentation", "interview_guide", "architecture", "database", "api", 
    "security", "research", "performance", "roadmap", "project_status", 
    "deployment", "user_manual", "developer_guide"
]

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            background-color: #0d1117;
            color: #c9d1d9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
        }}
        h1, h2, h3, h4, h5, h6 {{
            color: #f0f6fc;
            border-bottom: 1px solid #21262d;
            padding-bottom: 0.3em;
        }}
        a {{ color: #58a6ff; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        code {{
            background-color: rgba(110,118,129,0.4);
            padding: 0.2em 0.4em;
            border-radius: 6px;
            font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
        }}
        pre {{
            background-color: #161b22;
            padding: 16px;
            border-radius: 6px;
            overflow: auto;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 20px;
        }}
        th, td {{
            border: 1px solid #30363d;
            padding: 8px 13px;
        }}
        th {{ background-color: #161b22; }}
        tr:nth-child(even) {{ background-color: #161b22; }}
    </style>
</head>
<body>
    {content}
</body>
</html>"""

# We map the exact filenames to the required HTML files
html_map = {
    "presentation": "PRESENTATION.md",
    "interview_guide": "INTERVIEW_GUIDE.md",
    "architecture": "ARCHITECTURE.md",
    "database": "DATABASE.md",
    "api": "API_DOCUMENTATION.md",
    "security": "SECURITY_REVIEW.md",
    "research": "RESEARCH.md",
    "performance": "PERFORMANCE.md",
    "roadmap": "PROJECT_ROADMAP.md",
    "project_status": "CURRENT_PROJECT_STATUS.md",
    "deployment": "DEPLOYMENT.md",
    "user_manual": "USER_MANUAL.md",
    "developer_guide": "DEVELOPER_GUIDE.md"
}

for html_name, md_name in html_map.items():
    md_path = os.path.join(DOCS_DIR, md_name)
    if os.path.exists(md_path):
        with open(md_path, "r", encoding="utf-8") as f:
            md_content = f.read()
        
        # Simple markdown to HTML conversion
        html_content = markdown.markdown(md_content, extensions=['tables', 'fenced_code'])
        
        full_html = HTML_TEMPLATE.format(
            title=html_name.replace("_", " ").title(),
            content=html_content
        )
        
        with open(os.path.join(HTML_DIR, f"{html_name}.html"), "w", encoding="utf-8") as f:
            f.write(full_html)

print("Documentation generated successfully.")
