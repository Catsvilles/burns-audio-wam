/* eslint-disable class-methods-use-this */
/* eslint-disable max-len */
/* eslint-disable import/extensions */
/* eslint-disable max-classes-per-file */
/* eslint-disable no-underscore-dangle */

import { WebAudioModule,  } from '@webaudiomodules/sdk';
import { ParamMgrFactory, CompositeAudioNode} from '@webaudiomodules/sdk-parammgr'
import { DrumSamplerNode } from './Node';
import { h, render } from 'preact';
import { DrumSamplerView } from './views/DrumSamplerView'
import { getBaseUrl } from '../../shared/getBaseUrl';

export default class DrumSampler extends WebAudioModule<DrumSamplerNode> {
	//@ts-ignore
	_baseURL = getBaseUrl(new URL('.', __webpack_public_path__));

	_descriptorUrl = `${this._baseURL}/descriptor.json`;

	async _loadDescriptor() {
		const url = this._descriptorUrl;
		if (!url) throw new TypeError('Descriptor not found');
		const response = await fetch(url);
		const descriptor = await response.json();
		Object.assign(this.descriptor, descriptor);
		return descriptor
	}

	async initialize(state: any) {
		await this._loadDescriptor();
		return super.initialize(state);
	}

	async createAudioNode(initialState: any) {
		const node = new DrumSamplerNode(this.audioContext);
		const paramsConfig = Object.assign({}, ...node.voices.map((v, i) => v.paramsConfig(i+1)))
		paramsConfig["compression"] = {
			minValue: 0,
			maxValue: 1,
			defaultValue: 0,
		}
        const internalParamsConfig = Object.assign({}, ...node.voices.map((v, i) => v.internalParamsConfig(i+1)))
		internalParamsConfig["compThreshold"] = node.compressor.threshold
		internalParamsConfig["compRatio"] = node.compressor.ratio
		internalParamsConfig["compKnee"] = node.compressor.knee
		internalParamsConfig["compAttack"] = node.compressor.attack
		internalParamsConfig["compRelease"] = node.compressor.release
		const paramsMapping = Object.assign({}, ...node.voices.map((v, i) => v.paramsMapping(i+1)))
		paramsMapping['compression'] = {
			compThreshold: {
				sourceRange: [0, 1],
				targetRange: [0, -40]
			},
			compRatio: {
				sourceRange: [0, 1],
				targetRange: [1, 20]
			},
			compKnee: {
				sourceRange: [0, 1],
				targetRange: [20, 0.1]
			},
			compAttack: {
				sourceRange: [0, 1],
				targetRange: [0.01, 0.0001]
			},
			compRelease: {
				sourceRange: [0, 1],
				targetRange: [0.05, 0.3]
			}
		}
        const optionsIn = { internalParamsConfig, paramsConfig, paramsMapping };
		const paramMgrNode = await ParamMgrFactory.create(this, optionsIn);
		
		node.setup(paramMgrNode);

		if (initialState) node.setState(initialState);
		return node;
    }

	async createGui() {
		const div = document.createElement('div');
		// hack because h() is getting stripped for non-use despite it being what the JSX compiles to
		h("div", {})

		var shadow = div.attachShadow({mode: 'open'});
		let initialState = this.audioNode.paramMgr.getParamsValues()

		render(<DrumSamplerView initialState={initialState} plugin={this}></DrumSamplerView>, shadow);

		return div;
	}

	destroyGui(el: Element) {
		render(null, el.shadowRoot)
	}
}
