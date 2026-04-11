import fs from 'fs';
import path from 'path';

const srcDir = "C:\\Users\\amish\\OneDrive\\Desktop\\Personal\\three-oaks-motel\\Pictures";
const destDir = path.join(process.cwd(), "public", "images", "gallery");
const metadataFile = path.join(process.cwd(), "src", "data", "galleryAssets.ts");

if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, {recursive: true});
if (!fs.existsSync(path.dirname(metadataFile))) fs.mkdirSync(path.dirname(metadataFile), {recursive: true});

const files = fs.readdirSync(srcDir);
const jpgs = files.filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg'));

let exportsArr = [];
for (const f of jpgs) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
    exportsArr.push(f);
}

const content = `// Auto-generated gallery assets\nexport const galleryImages = ${JSON.stringify(exportsArr, null, 2)};\n`;
fs.writeFileSync(metadataFile, content);

console.log(`Copied ${jpgs.length} images to gallery!`);
