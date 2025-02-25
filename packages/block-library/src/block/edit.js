/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useSelect, useDispatch } from '@wordpress/data';
import { useRef, useMemo, useEffect } from '@wordpress/element';
import {
	useEntityRecord,
	store as coreStore,
	useEntityBlockEditor,
} from '@wordpress/core-data';
import {
	Placeholder,
	Spinner,
	ToolbarButton,
	ToolbarGroup,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import {
	useInnerBlocksProps,
	RecursionProvider,
	useHasRecursion,
	useBlockProps,
	Warning,
	privateApis as blockEditorPrivateApis,
	store as blockEditorStore,
	BlockControls,
} from '@wordpress/block-editor';
import { privateApis as patternsPrivateApis } from '@wordpress/patterns';
import { store as blocksStore } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { name as patternBlockName } from './index';
import { unlock } from '../lock-unlock';

const { useLayoutClasses } = unlock( blockEditorPrivateApis );
const { isOverridableBlock, hasOverridableBlocks } =
	unlock( patternsPrivateApis );

const fullAlignments = [ 'full', 'wide', 'left', 'right' ];

const useInferredLayout = ( blocks, parentLayout ) => {
	const initialInferredAlignmentRef = useRef();

	return useMemo( () => {
		// Exit early if the pattern's blocks haven't loaded yet.
		if ( ! blocks?.length ) {
			return {};
		}

		let alignment = initialInferredAlignmentRef.current;

		// Only track the initial alignment so that temporarily removed
		// alignments can be reapplied.
		if ( alignment === undefined ) {
			const isConstrained = parentLayout?.type === 'constrained';
			const hasFullAlignment = blocks.some( ( block ) =>
				fullAlignments.includes( block.attributes.align )
			);

			alignment = isConstrained && hasFullAlignment ? 'full' : null;
			initialInferredAlignmentRef.current = alignment;
		}

		const layout = alignment ? parentLayout : undefined;

		return { alignment, layout };
	}, [ blocks, parentLayout ] );
};

function setBlockEditMode( setEditMode, blocks, mode ) {
	blocks.forEach( ( block ) => {
		const editMode =
			mode ||
			( isOverridableBlock( block ) ? 'contentOnly' : 'disabled' );
		setEditMode( block.clientId, editMode );

		setBlockEditMode(
			setEditMode,
			block.innerBlocks,
			// Disable editing for nested patterns.
			block.name === patternBlockName ? 'disabled' : mode
		);
	} );
}

function RecursionWarning() {
	const blockProps = useBlockProps();
	return (
		<div { ...blockProps }>
			<Warning>
				{ __( 'Block cannot be rendered inside itself.' ) }
			</Warning>
		</div>
	);
}

const NOOP = () => {};

// Wrap the main Edit function for the pattern block with a recursion wrapper
// that allows short-circuiting rendering as early as possible, before any
// of the other effects in the block edit have run.
export default function ReusableBlockEditRecursionWrapper( props ) {
	const { ref } = props.attributes;
	const hasAlreadyRendered = useHasRecursion( ref );

	if ( hasAlreadyRendered ) {
		return <RecursionWarning />;
	}

	return (
		<RecursionProvider uniqueId={ ref }>
			<ReusableBlockEdit { ...props } />
		</RecursionProvider>
	);
}

function ReusableBlockEdit( {
	name,
	attributes: { ref, content },
	__unstableParentLayout: parentLayout,
	clientId: patternClientId,
	setAttributes,
} ) {
	const { record, hasResolved } = useEntityRecord(
		'postType',
		'wp_block',
		ref
	);
	const [ blocks ] = useEntityBlockEditor( 'postType', 'wp_block', {
		id: ref,
	} );
	const isMissing = hasResolved && ! record;

	const { setBlockEditingMode, __unstableMarkLastChangeAsPersistent } =
		useDispatch( blockEditorStore );

	const {
		innerBlocks,
		userCanEdit,
		onNavigateToEntityRecord,
		editingMode,
		hasPatternOverridesSource,
	} = useSelect(
		( select ) => {
			const { canUser } = select( coreStore );
			const {
				getBlocks,
				getSettings,
				getBlockEditingMode: _getBlockEditingMode,
			} = select( blockEditorStore );
			const { getBlockBindingsSource } = unlock( select( blocksStore ) );
			const canEdit = canUser( 'update', 'blocks', ref );

			// For editing link to the site editor if the theme and user permissions support it.
			return {
				innerBlocks: getBlocks( patternClientId ),
				userCanEdit: canEdit,
				getBlockEditingMode: _getBlockEditingMode,
				onNavigateToEntityRecord:
					getSettings().onNavigateToEntityRecord,
				editingMode: _getBlockEditingMode( patternClientId ),
				hasPatternOverridesSource: !! getBlockBindingsSource(
					'core/pattern-overrides'
				),
			};
		},
		[ patternClientId, ref ]
	);

	// Sync the editing mode of the pattern block with the inner blocks.
	useEffect( () => {
		setBlockEditMode(
			setBlockEditingMode,
			innerBlocks,
			// Disable editing if the pattern itself is disabled.
			editingMode === 'disabled' || ! hasPatternOverridesSource
				? 'disabled'
				: undefined
		);
	}, [
		editingMode,
		innerBlocks,
		setBlockEditingMode,
		hasPatternOverridesSource,
	] );

	const canOverrideBlocks = useMemo(
		() => hasPatternOverridesSource && hasOverridableBlocks( blocks ),
		[ hasPatternOverridesSource, blocks ]
	);

	const { alignment, layout } = useInferredLayout( blocks, parentLayout );
	const layoutClasses = useLayoutClasses( { layout }, name );

	const blockProps = useBlockProps( {
		className: clsx(
			'block-library-block__reusable-block-container',
			layout && layoutClasses,
			{ [ `align${ alignment }` ]: alignment }
		),
	} );

	// Use `blocks` variable until `innerBlocks` is populated, which has the proper clientIds.
	const innerBlocksProps = useInnerBlocksProps( blockProps, {
		templateLock: 'all',
		layout,
		value: innerBlocks.length > 0 ? innerBlocks : blocks,
		onInput: NOOP,
		onChange: NOOP,
		renderAppender: blocks?.length ? undefined : blocks.ButtonBlockAppender,
	} );

	const handleEditOriginal = () => {
		onNavigateToEntityRecord( {
			postId: ref,
			postType: 'wp_block',
		} );
	};

	const resetContent = () => {
		if ( content ) {
			// Make sure any previous changes are persisted before resetting.
			__unstableMarkLastChangeAsPersistent();
			setAttributes( { content: undefined } );
		}
	};

	let children = null;

	if ( isMissing ) {
		children = (
			<Warning>
				{ __( 'Block has been deleted or is unavailable.' ) }
			</Warning>
		);
	}

	if ( ! hasResolved ) {
		children = (
			<Placeholder>
				<Spinner />
			</Placeholder>
		);
	}

	return (
		<>
			{ userCanEdit && onNavigateToEntityRecord && (
				<BlockControls>
					<ToolbarGroup>
						<ToolbarButton onClick={ handleEditOriginal }>
							{ __( 'Edit original' ) }
						</ToolbarButton>
					</ToolbarGroup>
				</BlockControls>
			) }

			{ canOverrideBlocks && (
				<BlockControls>
					<ToolbarGroup>
						<ToolbarButton
							onClick={ resetContent }
							disabled={ ! content }
						>
							{ __( 'Reset' ) }
						</ToolbarButton>
					</ToolbarGroup>
				</BlockControls>
			) }

			{ children === null ? (
				<div { ...innerBlocksProps } />
			) : (
				<div { ...blockProps }>{ children }</div>
			) }
		</>
	);
}
