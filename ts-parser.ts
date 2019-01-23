import * as ts from "typescript";
import * as fs from "fs";
import * as glob from 'glob';
import * as path from 'path';

interface DocEntry {
	name?: string;
	fileName?: string;
	documentation?: string;
	type?: TypeInfo;
	parameters?: DocParameter[];
	returnType?: TypeInfo;
	implements?: string[];
	documented?: boolean;
	private?: boolean;
	kind: 'function' | 'property' | 'class' | 'constructor';
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

const tsConfig = require( './tsconfig.json' );

generateDocumentation(
	// TODO
	[
		...glob.sync( tsConfig.include[ 0 ] ),
		...glob.sync( tsConfig.include[ 1 ] ),
	],
	tsConfig.compilerOptions
);

/** Generate documentation for all classes in a set of .ts files */
function generateDocumentation(
	fileNames: string[],
	options: ts.CompilerOptions
): void {
	// Build a program using the set of root file names in fileNames
	let program = ts.createProgram( fileNames, options );

	// Get the checker, we will use it to find more about classes
	let checker = program.getTypeChecker();

	let output: DocEntry[] = [];

	// Visit every sourceFile in the program
	for ( const sourceFile of program.getSourceFiles() ) {
		if ( !sourceFile.isDeclarationFile ) {
			// Walk the tree to search for classes
			ts.forEachChild( sourceFile, node => visit( node ) );
		}
	}

	// print out the doc
	console.log( JSON.stringify( output, undefined, 4 ) );

	return;

	/** visit nodes finding exported classes */
	function visit( node: ts.Node ) {
		// TODO: parse typedefs here or when they appears at runtime.

		// Only consider exported nodes
		if ( !isNodeExported( node ) ) {
			return;
		}

		if ( ts.isClassDeclaration( node ) && node.name ) {
			let classSymbol = checker.getSymbolAtLocation( node.name );
			const symbols = classSymbol.members.values();
			output.push( serializeClass( classSymbol ) );

			while ( true ) {
				const itResult = symbols.next();

				if ( itResult.done ) {
					break;
				}

				const symbol = itResult.value;

				const member = getDeclaration( symbol );

				if ( ts.isConstructorDeclaration( member ) ) {
					output.push( ...serializeConstructor( symbol ) );
				} else if ( ts.isMethodDeclaration( member ) ) {
					output.push( serializeMethod( symbol ) );
				} else /* member is a property declaration */ {
					output.push( serializeProperty( symbol ) );
				}
			}

		} else if ( ts.isModuleDeclaration( node ) ) {
			// This is a namespace, visit its children
			ts.forEachChild( node, childNode => visit( childNode ) );
		} else if ( ts.isFunctionDeclaration( node ) ) {
			const fnSymbol = checker.getSymbolAtLocation( node.name );
			output.push( serializeMethod( fnSymbol ) );
		}
	}

	function serializeClass( symbol: ts.Symbol ): DocEntry {
		const jsDocTags = symbol.getJsDocTags();

		return {
			...serializeSymbol( symbol ),
			kind: 'class',
			implements: jsDocTags.filter( tag => tag.name === 'implements' ).map( tag => tag.text ),
		}
	}

	function serializeProperty( symbol: ts.Symbol ): DocEntry {
		return {
			kind: 'property',
			...serializeSymbol( symbol ),
		}
	}

	function serializeConstructor( symbol: ts.Symbol ): DocEntry[] {
		const constructorType = checker.getTypeOfSymbolAtLocation(
			symbol,
			symbol.valueDeclaration
		);

		return constructorType
			.getConstructSignatures()
			.map( serializeSignature )
			.map( signature => ( {
				kind: 'constructor' as 'constructor',
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
			documented: !!jsDocTags,
			private: jsDocTags.some( tag => tag.name === 'private' ),
			fileName: getFileName( getDeclaration( symbol ) ),
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

	/** True if this is visible outside this file, false otherwise */
	function isNodeExported( node: ts.Node ): boolean {
		return (
			( ts.getCombinedModifierFlags( node as ts.Declaration ) & ts.ModifierFlags.Export ) !== 0 ||
			( !!node.parent && node.parent.kind === ts.SyntaxKind.SourceFile )
		);
	}

	/** Serialize a symbol into a json object */
	function serializeSymbol( symbol: ts.Symbol ): Partial<DocEntry> {
		const jsDocTags = symbol.getJsDocTags();
		const type = checker.getTypeOfSymbolAtLocation( symbol, symbol.valueDeclaration );

		return {
			name: symbol.getName(),
			documentation: ts.displayPartsToString( symbol.getDocumentationComment( checker ) ),
			type: getTypeInfo( checker, type ),
			documented: !!jsDocTags,
			private: jsDocTags.some( tag => tag.name === 'private' ),
			fileName: getFileName( getDeclaration( symbol ) ),
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
}

// TODO: What type do we need at the end? How much deep it should be?
function getTypeInfo( checker: ts.TypeChecker, type: ts.Type ) {
	let fileName;

	// Primitive types don't have symbol.
	if ( type.symbol ) {
		fileName = getFileName( getDeclaration( type.symbol ) );
	}

	return {
		fileName,
		value: checker.typeToString( type )
	};
}

// TODO: Check why valueDeclaration sometimes doesn't exist.
function getDeclaration( symbol: ts.Symbol ): ts.Declaration {
	return symbol.valueDeclaration || symbol.declarations[ 0 ];
}

// TODO: Check why it happens that source files are sometimes relative and sometimes not.
function getFileName( declaration: ts.Declaration ) {
	const fileName = declaration.getSourceFile().fileName;

	const cwd = process.cwd();

	return path.relative( cwd, fileName );
}
