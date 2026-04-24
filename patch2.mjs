import fs from 'fs';
let text = fs.readFileSync('./frontend/src/components/Environment3D.jsx', 'utf8');

// The file contains two declarations of `function flattenInstancedMesh`.
// We should replace the FIRST occurrence entirely up to the second occurrence.
const firstIndex = text.indexOf('function flattenInstancedMesh');
if (firstIndex !== -1) {
    const secondIndex = text.indexOf('function flattenInstancedMesh', firstIndex + 1);
    if (secondIndex !== -1) {
        text = text.slice(0, firstIndex) + text.slice(secondIndex);
        fs.writeFileSync('./frontend/src/components/Environment3D.jsx', text);
        console.log('Successfully deduplicated flattenInstancedMesh');
    } else {
        console.log('Only one declaration found.');
    }
} else {
    console.log('None found.');
}
