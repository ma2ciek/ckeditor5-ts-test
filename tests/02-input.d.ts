/**
 * Point interface
 */
export interface Point {
	/**
	 * Position on the x axis.
	 */
	x: number;

	/**
	 * Position on the y axis.
	 */
	y: number;
}

/**
 * @template T Foo
 */
export interface Settable<T, X> {
	/**
	 * Set method
	 */
	set( propName: string, value: T ): void;
}

export interface Spy {
	/**
	 * Spy is like a normal type
	 */
	(): void;

	/** Cna be called with some weird params */
	( x: number ): void;

	/**
	 * But can be called.
	 */
	called: boolean;
}
