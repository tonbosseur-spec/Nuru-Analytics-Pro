import fs from 'fs';
let code = fs.readFileSync('main.py', 'utf8');
code = code.replace(/(\w+)\.to_dict\(orient='records'\)/g, 'json.loads($1.to_json(orient="records", date_format="iso"))');
fs.writeFileSync('main.py', code);
console.log('done');
