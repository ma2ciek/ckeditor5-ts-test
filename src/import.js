/**
 * @module abc
 */

import * as utils from './utils';

console.log(
	utils.isPointInTheRadius( { x: 1, y: 2 }, 30 )
);

/** @type {import('./utils').Point} */
let point;

/** @type {import('./interface').Point} */
let point2;

export {
	point,
	point2
};
