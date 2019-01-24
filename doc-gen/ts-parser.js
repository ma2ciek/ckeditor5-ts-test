"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const glob = require("glob");
const path = require("path");
const fs = require("fs-extra");
const generate_documentation_1 = require("./generate-documentation");
const ROOT = path.join(__dirname, '..');
const tsConfig = fs.readJsonSync(ROOT + '/src/tsconfig.json');
const files = [];
tsConfig.include.forEach((fileOrGlob) => {
    files.push(...glob.sync(ROOT + '/src/' + fileOrGlob));
});
const output = generate_documentation_1.default(files, tsConfig.compilerOptions);
// print out the doc
console.log(JSON.stringify(output, undefined, 4));
console.log('Success');
//# sourceMappingURL=ts-parser.js.map