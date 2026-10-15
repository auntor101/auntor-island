import fs from 'node:fs';
const f = process.argv[2];
const b = fs.readFileSync(f); const jl = b.readUInt32LE(12); const j = JSON.parse(b.slice(20, 20 + jl).toString());
console.log(JSON.stringify({ nodes: j.nodes, meshes: j.meshes.map(m => ({ n: m.name, p: m.primitives.map(p => ({ a: p.attributes, i: p.indices, m: j.materials[p.material].name })) })), acc: j.accessors.map(a => [a.componentType, a.type, a.count, a.min, a.max]) }));
