const acorn = require( 'acorn' );
const glob = require( 'glob' );
const fs = require( 'fs' );

const doclets = [];

for ( const file of glob.sync( 'packages/ckeditor5-ts-test/src/**/*.js' ) ) {
	let doclet = { file };

	const node = acorn.parse( fs.readFileSync( file ), {
		sourceType: 'module',
		onComment: ( isBlock, text, ) => {
			if ( isBlock ) {
				doclet = {
					comment: text,
					file
				};

				doclets.push( doclet );
			}
		},

		onToken: token => {
			switch ( token.type.label ) {
				case 'export': {
					doclet.exported = true;
					ensureLastDocletWillBePresent();
					break;
				}
				case 'function': {
					doclet.kind = 'function';
					ensureLastDocletWillBePresent();
					break;
				}

				case 'default': {
					doclet.defaultExport = true;
					break;
				}

				// let is also a name.
				case 'name': {
					if ( token.value === 'let' ) {
						doclet.kind = 'variable';
						doclet.variableKind = 'let';
					} else if ( Object.keys( doclet ).length > 1 ) {
						doclet.name = token.value;

						ensureLastDocletWillBePresent();
					}

					break;
				}

				default: {
					doclet = { file };
				}
			}
		}
	} );

	function ensureLastDocletWillBePresent() {
		if ( doclets[ doclets.length - 1 ] != doclet ) {
			doclets.push( doclet );
		}
	}
}

console.log( doclets );
