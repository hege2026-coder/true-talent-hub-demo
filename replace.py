import os
import glob

html_files = glob.glob('**/*.html', recursive=True)

for file in html_files:
    with open(file, 'r') as f:
        content = f.read()
    
    # 1. Update Title
    content = content.replace('True Talent Hub', 'People Engine')
    
    # 2. Update Google Font
    content = content.replace(
        'family=Outfit:wght@300;400;500;600',
        'family=Source+Sans+3:wght@300;400;500;600;700;800'
    )
    
    # 3. Update Logo structures
    # Some files use "logo" and "logo-mark"
    import re
    # We will replace <div class="logo"> ... </div> with the new logo
    logo_pattern = re.compile(r'<div class="logo".*?</div>\s*<span class="logo-text">.*?</span>\s*</div>', re.DOTALL)
    
    # Actually, the structure was:
    # <div class="logo">
    #     <div class="logo-mark">...</div>
    #     <span class="logo-text">True Talent Hub</span>
    # </div>
    
    def repl_logo(match):
        depth = '../' if '/' in file else './'
        return f'<div class="logo">\n                <img src="{depth}img/PeopleEngine-logo.png" alt="People Engine Logo">\n                <span class="logo-text"><strong>People</strong> <span>Engine</span></span>\n            </div>'
        
    content = re.sub(r'<div class="logo"[^>]*>.*?<span class="logo-text">.*?</span>\s*</div>', repl_logo, content, flags=re.DOTALL)
    
    # Replace global headers (like in dashboard, examen, etc.)
    # We want to change the wrapper structure too if it's admin-wrapper or dashboard-wrapper
    # Wait, I did that manually for admin/dashboard.html
    
    with open(file, 'w') as f:
        f.write(content)

