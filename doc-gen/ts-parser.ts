import * as glob from 'glob';
import * as path from 'path';
import * as fs from 'fs-extra';
import generateDocumentation from './generate-documentation';

const ROOT = path.join( __dirname, '..' );
const tsConfig = fs.readJsonSync( ROOT + '/src/tsconfig.json' );

const files: string[] = [];

tsConfig.include.forEach( ( fileOrGlob: string ) => {
	files.push( ...glob.sync( ROOT + '/src/' + fileOrGlob ) );
} );

const output = generateDocumentation(
	files,
	tsConfig.compilerOptions
);

// print out the doc
console.log( JSON.stringify( output, undefined, 4 ) );

console.log( 'Success' );
