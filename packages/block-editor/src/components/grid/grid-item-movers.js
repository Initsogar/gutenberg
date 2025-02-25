/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { ToolbarButton } from '@wordpress/components';
import { arrowLeft, arrowUp, arrowDown, arrowRight } from '@wordpress/icons';
import { useDispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import BlockControls from '../block-controls';
import { useGetNumberOfBlocksBeforeCell } from './use-get-number-of-blocks-before-cell';
import { store as blockEditorStore } from '../../store';

export function GridItemMovers( {
	layout,
	parentLayout,
	onChange,
	gridClientId,
	blockClientId,
} ) {
	const { moveBlocksToPosition, __unstableMarkNextChangeAsNotPersistent } =
		useDispatch( blockEditorStore );

	const columnStart = layout?.columnStart ?? 1;
	const rowStart = layout?.rowStart ?? 1;
	const columnSpan = layout?.columnSpan ?? 1;
	const rowSpan = layout?.rowSpan ?? 1;
	const columnEnd = columnStart + columnSpan - 1;
	const rowEnd = rowStart + rowSpan - 1;
	const columnCount = parentLayout?.columnCount;
	const rowCount = parentLayout?.rowCount;

	const getNumberOfBlocksBeforeCell = useGetNumberOfBlocksBeforeCell(
		gridClientId,
		columnCount
	);

	return (
		<BlockControls group="parent">
			<ToolbarButton
				icon={ arrowUp }
				label={ __( 'Move block up' ) }
				disabled={ rowStart <= 1 }
				onClick={ () => {
					onChange( {
						rowStart: rowStart - 1,
					} );
					__unstableMarkNextChangeAsNotPersistent();
					moveBlocksToPosition(
						[ blockClientId ],
						gridClientId,
						gridClientId,
						getNumberOfBlocksBeforeCell( columnStart, rowStart - 1 )
					);
				} }
			/>
			<ToolbarButton
				icon={ arrowDown }
				label={ __( 'Move block down' ) }
				disabled={ rowCount && rowEnd >= rowCount }
				onClick={ () => {
					onChange( {
						rowStart: rowStart + 1,
					} );
					__unstableMarkNextChangeAsNotPersistent();
					moveBlocksToPosition(
						[ blockClientId ],
						gridClientId,
						gridClientId,
						getNumberOfBlocksBeforeCell( columnStart, rowStart + 1 )
					);
				} }
			/>
			<ToolbarButton
				icon={ arrowLeft }
				label={ __( 'Move block left' ) }
				disabled={ columnStart <= 1 }
				onClick={ () => {
					onChange( {
						columnStart: columnStart - 1,
					} );
					__unstableMarkNextChangeAsNotPersistent();
					moveBlocksToPosition(
						[ blockClientId ],
						gridClientId,
						gridClientId,
						getNumberOfBlocksBeforeCell( columnStart - 1, rowStart )
					);
				} }
			/>
			<ToolbarButton
				icon={ arrowRight }
				label={ __( 'Move block right' ) }
				disabled={ columnCount && columnEnd >= columnCount }
				onClick={ () => {
					onChange( {
						columnStart: columnStart + 1,
					} );
					__unstableMarkNextChangeAsNotPersistent();
					moveBlocksToPosition(
						[ blockClientId ],
						gridClientId,
						gridClientId,
						getNumberOfBlocksBeforeCell( columnStart + 1, rowStart )
					);
				} }
			/>
		</BlockControls>
	);
}
