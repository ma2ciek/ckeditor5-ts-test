import * as path from 'path';
import * as ts from 'typescript';

export default function generateDocumentation(
	fileNames: string[],
	options: ts.CompilerOptions
): DocEntry[] {

	// Build a program using the set of root file names in fileNames
	const program = ts.createProgram( fileNames, options );

	// Get the checker, we will use it to find more about classes
	const checker = program.getTypeChecker();

	const output: DocEntry[] = [];

	// Visit every sourceFile in the program
	for ( const sourceFile of program.getSourceFiles() ) {
		if ( program.getRootFileNames().includes( sourceFile.fileName ) ) {
			// Walk the tree to search for exported stuff.
			ts.forEachChild( sourceFile, node => visit( node ) );
		}
	}

	return output;

	function visit( node: ts.Node ) {
		// TODO: parse typedefs here or when they appears at runtime.
		// Only consider exported nodes.
		if ( !isNodeExported( node ) ) {
			return;
		}

		if ( ts.isClassDeclaration( node ) && node.name ) {
			const classSymbol = checker.getSymbolAtLocation( node.name )!;
			const symbols = getValues( classSymbol.members );
			output.push( serializeClass( classSymbol ) );

			for ( const symbol of symbols ) {
				const member = getFirstDeclaration( symbol );

				if ( ts.isConstructorDeclaration( member ) ) {
					output.push( ...serializeConstructor( symbol ) );
				} else if ( ts.isMethodDeclaration( member ) ) {
					output.push( serializeMethod( symbol ) );
				} else /* member is a property declaration */ {
					output.push( serializeProperty( symbol ) );
				}
			}
		} else if ( ts.isFunctionDeclaration( node ) ) {
			// TODO - unnamed functions
			const functionSymbol = checker.getSymbolAtLocation( node.name! );
			output.push( serializeMethod( functionSymbol! ) );
		} else if ( ts.isInterfaceDeclaration( node ) ) {
			const interfaceDeclarationSymbol = checker.getSymbolAtLocation( node.name )!;
			output.push( serializeInterface( interfaceDeclarationSymbol ) );
		} else if ( ts.isVariableStatement( node ) ) {
			for ( const declaration of node.declarationList.declarations ) {
				const symbol = checker.getSymbolAtLocation( declaration.name )!
				output.push( { kind: 'variable', ...serializeSymbol( symbol ) } )
			}
		}
	}

	function serializeClass( symbol: ts.Symbol ): DocEntry {
		const jsDocTags = symbol.getJsDocTags();
		const output = serializeSymbol( symbol );

		return {
			kind: 'class',
			implements: jsDocTags.filter( tag => tag.name === 'implements' ).map( tag => tag.text! ),
			memberOf: output.meta.file,
			fullName: output.meta.file + output.name!,
			...output,
		}
	}

	function serializeProperty( symbol: ts.Symbol ): DocEntry {
		const output = serializeSymbol( symbol );
		const memberOf = getMemberOf( symbol );

		return {
			kind: 'property',
			memberOf,
			fullName: memberOf + '#' + output.name,
			...output
		}
	}

	function serializeConstructor( symbol: ts.Symbol ): DocEntry[] {
		const memberOf = getMemberOf( symbol );
		const fileName = getFileName( getFirstDeclaration( symbol ) );

		const constructorType = checker.getTypeOfSymbolAtLocation(
			symbol,
			symbol.valueDeclaration
		);

		return constructorType
			.getConstructSignatures()
			.map( serializeSignature )
			.map( signature => ( {
				kind: 'constructor' as 'constructor',
				fileName: fileName,
				memberOf,
				fullName: memberOf + '#constructor',
				...signature,
			} ) );
	}

	function serializeMethod( symbol: ts.Symbol ): DocEntry {
		const type = checker.getTypeOfSymbolAtLocation( symbol, symbol.valueDeclaration );
		const signatures = type.getCallSignatures();
		const jsDocTags = symbol.getJsDocTags();

		return {
			kind: 'function',
			name: symbol.getName(),
			documented: !!jsDocTags.length,
			private: jsDocTags.some( tag => tag.name === 'private' ),
			meta: getMetaData( symbol ),
			// memberOf: getMemberOf( symbol ),
			...serializeSignature( signatures[ 0 ] )
		};
	}

	/** Serialize a signature (call or construct) */
	function serializeSignature( signature: ts.Signature ) {
		return {
			parameters: signature.parameters.map( serializeParameter ),
			returnType: getTypeInfo( checker, signature.getReturnType() ),
			documentation: ts.displayPartsToString( signature.getDocumentationComment( checker ) )
		};
	}

	function getMemberOf( symbol: ts.Symbol ) {
		const declaration = getFirstDeclaration( symbol );
		const parentType = checker.getTypeAtLocation( declaration.parent );

		return getFileName( declaration ) + '/' + checker.typeToString( parentType );
	}

	/** Serialize a symbol into a json object */
	function serializeSymbol( symbol: ts.Symbol ) {
		const jsDocTags = symbol.getJsDocTags();
		const type = checker.getTypeOfSymbolAtLocation( symbol, symbol.valueDeclaration );

		return {
			name: symbol.getName(),
			documentation: ts.displayPartsToString( symbol.getDocumentationComment( checker ) ),
			type: getTypeInfo( checker, type ),
			documented: !!jsDocTags.length,
			private: jsDocTags.some( tag => tag.name === 'private' ),
			meta: getMetaData( symbol ),
		}
	}

	function serializeParameter( symbol: ts.Symbol ): DocParameter {
		const type = checker.getTypeOfSymbolAtLocation( symbol, symbol.valueDeclaration );

		return {
			name: symbol.getName(),
			documentation: ts.displayPartsToString( symbol.getDocumentationComment( checker ) ),
			type: getTypeInfo( checker, type ),
		};
	}

	function serializeInterface( symbol: ts.Symbol ): DocEntry {
		const jsDocTags = symbol.getJsDocTags();
		const type = checker.getTypeOfSymbolAtLocation( symbol, getFirstDeclaration( symbol ) );
		const meta = getMetaData( symbol );

		const members = getValues( symbol.members );

		// TODO
		const properties = members.filter( type => !!( type.flags & 4 ) );
		const templates = members.filter( type => !!( type.flags & 262144 ) );
		const methods = members.filter( type => !!( type.flags & 8192 ) );
		const callMember = members.find( type => !!( type.flags & 131072 ) );

		if ( callMember ) {
			const declarations = callMember.declarations;

			declarations.forEach( declaration => {
				// const s = checker.getSymbolAtLocation( declaration );
				// console.log( s );
				// type: checker.getTypeOfSymbolAtLocation( checker.getSymbolAtLocation( declaration ), declaration )
			} );
		}

		// TODO
		output.push(
			...properties.map( p => serializeProperty( p ) ),
			...methods.map( p => serializeMethod( p ) ),
		);

		return {
			kind: 'interface',
			name: symbol.getName(),
			fullName: meta.file + '/' + symbol.getName(),
			meta,
			documentation: ts.displayPartsToString( symbol.getDocumentationComment( checker ) ),
			type: getTypeInfo( checker, type ), // TODO - it's not correct actually.
			documented: !!jsDocTags.length,
			private: jsDocTags.some( tag => tag.name === 'private' ),
			templates: templates.map( t => ( {
				name: t.name,
				documentation: ts.displayPartsToString( t.getDocumentationComment( checker ) ),
			} ) ),
			// callSignatures: callMemberTypes.map( member => serializeSignature( member.getCallSignatures()[ 0 ] ) )
		}
	}
}

/** True if this is visible outside this file, false otherwise */
function isNodeExported( node: ts.Node ): boolean {
	return (
		( ts.getCombinedModifierFlags( node as ts.Declaration ) & ts.ModifierFlags.Export ) !== 0 ||
		( !!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile )
	);
}

// TODO: What type do we need at the end? How much deep it should be?
function getTypeInfo( checker: ts.TypeChecker, type: ts.Type ): TypeInfo {
	const typeInfo: TypeInfo = {
		value: checker.typeToString( type )
	}

	// Primitive types don't have symbol.
	if ( type.symbol ) {
		typeInfo.file = getFileName( getFirstDeclaration( type.symbol ) );
	}

	return typeInfo;
}

// TODO: Check why valueDeclaration sometimes doesn't exist.
function getFirstDeclaration( symbol: ts.Symbol ): ts.Declaration {
	if ( !symbol.declarations ) {
		// It means that some file is missing or a type is incorrect.

		console.log( symbol );
		throw new Error( `Missing declaration for the symbol: ${ symbol }.` );
	}

	return symbol.valueDeclaration || symbol.declarations[ 0 ];
}

function getMetaData( symbol: ts.Symbol ): MetaData {
	const declaration = getFirstDeclaration( symbol );

	return {
		file: getFileName( declaration ),
		start: declaration.getStart(),
		end: declaration.getEnd(),
	}
}

// TODO: Check why it happens that source files are sometimes relative and sometimes not.
function getFileName( declaration: ts.Declaration ) {
	const fileName = declaration.getSourceFile().fileName;

	return shortFileName( fileName );
}

function shortFileName( fileName: string ) {
	const cwd = process.cwd();

	return path.relative( cwd, fileName );
}

function getValues<T>( map?: ts.UnderscoreEscapedMap<T> ): T[] {
	if ( !map ) {
		return [];
	}

	const it = map.values();
	const values: T[] = [];

	while ( true ) {
		const result = it.next();

		if ( result.done ) {
			return values;
		} else {
			values.push( result.value );
		}
	}
}

// class IdManager<T extends object> {
// 	map = new WeakMap<T, number>();
// 	id = -1;

// 	set( e: T ) {
// 		const id = ++this.id;
// 		this.map.set( id, e );
// 	}


// }

interface DocEntry {
	name?: string;
	meta?: MetaData;
	documentation?: string;
	type?: TypeInfo;
	parameters?: DocParameter[];
	returnType?: TypeInfo;
	implements?: string[];
	documented?: boolean;
	private?: boolean;
	kind: 'function' | 'property' | 'class' | 'constructor' | 'interface' | 'variable';
	templates?: {
		name: string;
		documentation: string;
	}[];
	id?: number;
	memberOf?: string; // TODO: id would be better (?).
	fullName?: string;
	callSignatures?: any[]; // TODO
}

interface MetaData {
	file: string;
	start: number;
	end: number;
}

interface DocParameter {
	name: string;
	documentation: string;
	type: TypeInfo;
}

interface TypeInfo {
	value: string;
	file?: string;
}
