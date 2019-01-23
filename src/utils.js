/**
 * @module utils
 */

/**
 * Some comment
 *
 * @param {Point} point
 * @param {Number} radius
 * @returns {Boolean}
 */
export function isPointInTheRadius( point, radius ) {
	return Math.sqrt( point.x * point.x + point.y * point.y ) < radius * radius;
}

/**
 * @public
 * @typedef {Object} Point
 * @property {Number} x
 * @property {Number} y
 */

/**
 * @public
 * @typedef {Object} Point2
 * @property {Number} x
 * @property {Number} y
 */
