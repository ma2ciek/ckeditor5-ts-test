/**
 * @module someModule
 */

/**
 * Documentation for C
 *
 * @implements X
 */
class C {
	/**
     * constructor documentation
     * @param {import('./utils').Point} a my parameter documentation
     * @param {Number|String} b another parameter documentation
     */
	constructor( a, b ) {
		/**
		 * @type {Number}
		 */
		this.a = 0;

		console.log( a, b );
	}

	/**
	 * @private
	 * @param  {any[]} args
	 */
	foo( args ) {
		return args;
	}
}

export default C;
