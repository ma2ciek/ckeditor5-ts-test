const glob = require( 'glob' );
const fs = require( 'fs-extra' );
const { expect } = require( 'chai' );
const generateDocumentation = require( './doc-gen/generate-documentation' ).default;

const testFiles = glob.sync( 'tests/**' );

const inputTestFiles = testFiles.filter( file => file.includes( '-input.' ) );

for ( const inputTestFileName of inputTestFiles ) {
	const match = inputTestFileName.match( /([0-9]+)-input/ );

	const expectedOutputFileName = 'tests/' + match[ 1 ] + '-output.json';

	if ( !fs.existsSync( expectedOutputFileName ) ) {
		throw new Error( `Output file doesn't exist for the ${ inputTestFileName }` );
	}

	const output = generateDocumentation( [ inputTestFileName ], {
		allowJs: true,
		noEmit: true,
		checkJs: true,
		target: 'es6'
	} );

	const expectedOutput = fs.readJsonSync( expectedOutputFileName );

	// if ( output.length !== expectedOutput.length ) {
	// 	console.log( JSON.stringify( output, null, 4 ) );
	// }

	try {
		expect( output ).to.deep.equal( expectedOutput );
		console.log( inputTestFileName );
	} catch ( err ) {
		console.error( '\nError in ' + inputTestFileName );
		console.error( err.message );

		console.error( 'Expected:\n' );
		console.error( JSON.stringify( err.expected, null, 3 ) );

		console.error( '\nActual:\n' );
		console.error( JSON.stringify( err.actual, null, 3 ) );

		console.log();
	}
}
