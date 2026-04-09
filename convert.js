const fs = require('fs');

let html = fs.readFileSync('reference.html', 'utf-8');

const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/);
if (!bodyMatch) process.exit(1);
let content = bodyMatch[1];
content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

content = content.replace(/class="/g, 'className="');
content = content.replace(/for="/g, 'htmlFor="');
content = content.replace(/src="images\/(.*?)\.png"/g, 'src="/images/$1.jpg"');
content = content.replace(/data-src="images\/(.*?)\.png"/g, 'data-src="/images/$1.jpg"');
content = content.replace(/allowfullscreen=""/g, 'allowFullScreen={true}');
content = content.replace(/novalidate/g, 'noValidate');
content = content.replace(/onclick="[^"]*"/gi, '');

// Convert select/option selected
content = content.replace(/<option([^>]*)selected([^>]*)>/gi, '<option$1defaultValue={true}$2>');

content = content.replace(/<img([^>]*)>/g, (m, p1) => {
    if (m.endsWith('/>')) return m;
    return `<img${p1} />`;
});
content = content.replace(/<input([^>]*)>/g, (m, p1) => {
    if (m.endsWith('/>')) return m;
    return `<input${p1} />`;
});
content = content.replace(/<br>/g, '<br />');
content = content.replace(/<!--([\s\S]*?)-->/g, '{/*$1*/}');
content = content.replace(/&nbsp;/g, ' ');

content = content.replace(/style="([^"]*)"/g, (match, p1) => {
    let objStr = p1.split(';').filter(s => s.trim()).map(s => {
        let [k,v] = s.split(':');
        if(!k) return '';
        k = k.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
        return `${k}: "${v.trim()}"`;
    }).join(', ');
    return `style={{${objStr}}}`;
});

content = content.replace(
    /<li><a href="#booking" className="mobile-book-btn">.*?<\/li>/,
    `$&<li><Link to="/admin" className="nav-link"><i className="fas fa-lock"></i> Admin</Link></li>`
);

let finalCode = `import { useEffect } from 'react';\nimport { Link } from 'react-router-dom';\n\nexport default function HomePage() {\n  useEffect(() => {\n    // Load external script organically inside React on mount so scroll works on route changes\n    const script = document.createElement('script');\n    script.src = '/js/main.js';\n    script.async = true;\n    document.body.appendChild(script);\n    return () => { document.body.removeChild(script); };\n  }, []);\n\n  return (\n    <>\n${content}\n    </>\n  );\n}\n`;

fs.writeFileSync('frontend/src/pages/HomePage.tsx', finalCode);

console.log("Converted successfully!");
