import { AudioWorkletGlobalScope, WamTransportData } from "@webaudiomodules/api";

type Loop = {
    enabled: boolean
    startBar: number
    loopLength: number
}

const getAudioRecorderProcessor = (moduleId: string) => {
    const audioWorkletGlobalScope: AudioWorkletGlobalScope = globalThis as unknown as AudioWorkletGlobalScope
    const { registerProcessor } = audioWorkletGlobalScope;

    const ModuleScope = audioWorkletGlobalScope.webAudioModules.getModuleScope(moduleId);
	const WamProcessor = ModuleScope.WamProcessor
    
    class AudioRecording {
        channels: Float32Array[]
        playhead: number
        token: string;
        loop: Loop;

        loopStartSample: number
        loopLengthSamples: number

        constructor(token: string, channels: Float32Array[]) {
            this.token = token
            this.channels = channels
            this.loop = {
                enabled: false,
                startBar: 0,
                loopLength: 8,
            }
        }

        setLoop(loop: Loop, transport: WamTransportData) {
            const {sampleRate} = audioWorkletGlobalScope

            this.loop.enabled = loop.enabled
            if (loop.enabled) {
                const loopStartTime = (loop.startBar * transport.timeSigNumerator) * 60 / transport.tempo
                this.loopStartSample = Math.floor(loopStartTime * sampleRate)
                const loopLength = (loop.loopLength * transport.timeSigNumerator) * 60 / transport.tempo
                this.loopLengthSamples = Math.floor(loopLength)
            }
        }

        writeInto(playhead: number, startSample: number, endSample: number, output: Float32Array[]) {
            if (this.channels.length == 0 || this.channels[0].length == 0) {
                return
            }

            for (let chan = 0; chan < output.length; chan++) {
                let readChan = chan % this.channels.length

                let pos = playhead % this.channels[0].length

                for (let i = startSample; i <= endSample; i++) {
                    output[chan][i] = this.channels[readChan][pos]
                    pos++
                    if (pos > this.channels[readChan].length) {
                        pos = pos % this.channels[0].length
                    }
                }
            }
        }
    }
		
    class AudioRecorderProcessor extends WamProcessor {
        recordingArmed: boolean
        recordingActive: boolean
        
        transportData?: WamTransportData
        clips: Map<string, AudioRecording[]>

        samplesElapsed: number
        playing: boolean
        playingClipId: string
        recordingClipId: string

        constructor(options: any) {
            super(options);

            const {
                moduleId,
                instanceId,
            } = options.processorOptions;

            this.recordingArmed = false
            this.clips = new Map()

            super.port.start();
        }

        startRecording() {
            this.recordingArmed = true
        }

        stopRecording() {
            this.recordingArmed = false
        }

        /**
         * Implement custom DSP here.
         * @param {number} startSample beginning of processing slice
         * @param {number} endSample end of processing slice
         * @param {Float32Array[][]} inputs
         * @param {Float32Array[][]} outputs
         */
        _process(startSample: number, endSample: number, inputs: Float32Array[][], outputs: Float32Array[][]) {
            let channels = inputs[0]

            if (!this.transportData || !this.transportData.playing) {
                if (this.recordingActive) {
                    console.log("Finalizing sample")
                    this.port.postMessage({source: "ar", clipId: this.recordingClipId, action: "finalize"})

                    // transport has stopped, we were recording.. now we are not
                    this.recordingActive = false
                }

                this.playing = false

                return
            }

            if (!this.playing && this.transportData.playing) {
                // transport just started
                this.playing = true
                this.samplesElapsed = 0

                console.log("transport just started")

                if (this.recordingArmed) {
                    console.log("setting recordingActive, setting recordingClipId to ", this.playingClipId)
                    this.recordingClipId = this.playingClipId
                    this.recordingActive = true
                }
            }

            if (this.recordingActive && channels.length > 0) {
                // not 100% necessary right now but if we change this to keep audio on processor side always then
                // it will be required again since I/O buffers get reused

                let copy: Float32Array[] = channels.map(c => {
                    let result = new Float32Array(c.length)
                    for (let j = 0; j < c.length; j++) {
                        result[j] = c[j]
                    }
                    return result
                })
                
                this.port.postMessage({source: "ar", buffer: {startSample, endSample, channels: copy}})
            }

            let clips = this.clips.get(this.playingClipId) ?? []
            
            for (let take of clips) {
                take.writeInto(this.samplesElapsed, startSample, endSample, outputs[0])
            }

            this.samplesElapsed += (endSample - startSample)

            for (let i = 0; i < inputs.length; i++) {
                for (let j = 0; j < inputs[i].length; j++) {
                    // iterate over channels L/R/A/B/C/...

                    for (let k = 0; k < inputs[i][j].length; k++) {
                        // iterate over individual samples

                        // TODO faster copy is available im sure
                        outputs[i][j][k] += inputs[i][j][k]
                    }
                }
            }

            return;
        }

        _onMidi(midiData: any) {        
            
        }

        _onTransport(transportData: WamTransportData) {
            this.transportData = transportData
    
            super.port.postMessage({
                event:"transport",
                transport: transportData
            })
        }

        // /**
        //  * Messages from main thread appear here.
        //  * @param {MessageEvent} message
        //  */
        async _onMessage(message: any): Promise<void> {
            if (message.data && message.data.source == "ar") {
                if (message.data.action == "record") {
                    console.log("Received recording message: ", message.data)
                    if (message.data.recording) {
                        this.startRecording()
                    } else {
                        this.stopRecording()
                    }
                }

                if (message.data.action == "load") {
                    console.log("Received track load for token ", message.data.token)

                    if (!this.clips.get(message.data.clipId)) {
                        this.clips.set(message.data.clipId, [])
                    }
                    this.clips.get(message.data.clipId).push(new AudioRecording(message.data.token, message.data.buffer))
                } else if (message.data.action == "delete") {
                    console.log("Processor removing track ", message.data.token, "on clip ", message.data.clipId)

                    let existing = this.clips.get(message.data.clipId)
                    existing = existing.filter(s => s.token !== message.data.token)
                    this.clips.set(message.data.clipId, existing)
                } else if (message.data.action == "play") {
                    console.log("received play message for clipId %s", message.data.clipId)
                    this.playingClipId = message.data.clipId
                } else if (message.data.action == "loop") {
                    console.log("Received looper settings for track %s", message.data.token)
                    let existing = this.clips.get(message.data.clipId).find(take => take.token == message.data.token)
                    if (existing) {
                        existing.loop = message.data.loop
                        
                    }
                }

            } else {
                // @ts-ignore
                super._onMessage(message)
            }
        }
    }

    try {
		registerProcessor('TomBurnsAudioRecorder', (AudioRecorderProcessor as typeof WamProcessor));
	} catch (error) {
		console.warn(error);
	}

	return AudioRecorderProcessor;
}

export default getAudioRecorderProcessor