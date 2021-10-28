import WamParameter from "@webaudiomodules/sdk/src/WamParameter.js"
// @ts-ignore
globalThis.WamParameter = WamParameter;

import WamParameterInterpolator from "@webaudiomodules/sdk/src/WamParameterInterpolator"
import WamProcessor from "@webaudiomodules/sdk/src/WamProcessor";

// @ts-ignore
globalThis.WamParameterInterpolator = WamParameterInterpolator

interface AudioWorkletProcessor {
    readonly port: MessagePort;
    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean;
}

declare var AudioWorkletProcessor: {
    prototype: AudioWorkletProcessor;
    new (options?: AudioWorkletNodeOptions): AudioWorkletProcessor;
};

declare function registerProcessor(
    name: string,
    processorCtor: (new (
        options?: AudioWorkletNodeOptions
    ) => AudioWorkletProcessor) & {
        parameterDescriptors?: AudioParamDescriptor[];
    }
): undefined;

const audioWorkletGlobalScope = globalThis;

// other variables that could be included:
// - renderAhead: number - how far into the future should plugins render?

class VideoGenProcessor extends WamProcessor {
	// @ts-ignore
    _generateWamParameterInfo() {
        return {
        }
    }

    lastTime: number
    proxyId: string

	constructor(options: any) {
		super(options);

        const {
			moduleId,
			instanceId,
		} = options.processorOptions;

        // @ts-ignore
        const { webAudioModules } = audioWorkletGlobalScope;

        // @ts-ignore
        if (globalThis.WamProcessors) globalThis.WamProcessors[instanceId] = this;
        // @ts-ignore
		else globalThis.WamProcessors = { [instanceId]: this };

        super.port.start();
	}

    count = 0;

	/**
	 * Implement custom DSP here.
	 * @param {number} startSample beginning of processing slice
	 * @param {number} endSample end of processing slice
	 * @param {Float32Array[][]} inputs
	 * @param {Float32Array[][]} outputs
	 */
     _process(startSample: number, endSample: number, inputs: Float32Array[][], outputs: Float32Array[][]) {
        // @ts-ignore
        const { webAudioModules, currentTime } = audioWorkletGlobalScope;

		return;
	}

    _onMidi(midiData: any) {        
        // @ts-ignore
        const { currentTime } = audioWorkletGlobalScope;

        // /* eslint-disable no-lone-blocks */
        const bytes = midiData.bytes;
        let type = bytes[0] & 0xf0;
        const channel = bytes[0] & 0x0f;
        const data1 = bytes[1];
        const data2 = bytes[2];

        if (type === 0x90 && data2 === 0) type = 0x80;

        switch (type) {
        case 0x80: { /* note off */
        } break;
        case 0x90: { /* note on */
        } break;
        
        default: { 
         } break;
        }
    }
}

try {
	registerProcessor('TomBurnsVideoGen', VideoGenProcessor);
} catch (error) {
	// eslint-disable-next-line no-console
	console.warn(error);
}
