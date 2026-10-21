// Field Guide's $.state contract. Values here are metadata only (ADR 0003): keys of the form
// "<turn index>:<finding kind>", never text from the transcript.
declare module 'claude-code' {
  interface PluginState {
    'field-guide': {
      toasted: string[]
      acknowledged: string[]
    }
  }
}
