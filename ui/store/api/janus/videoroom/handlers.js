export const mutations = {
  setPublisher (state, { handleDTO, isPublisher }) {
    handleDTO.isPublisher = isPublisher
  },
  setMedia (state, { handleDTO, media }) {
    if (media.sendVideo !== undefined) {
      handleDTO.sendVideo = media.sendVideo
    }
    if (media.sendAudio !== undefined) {
      handleDTO.sendAudio = media.sendAudio
    }
    if (media.sendData !== undefined) {
      handleDTO.sendData = media.sendData
    }
  },
  clearStream (state, { handleDTO }) {
    handleDTO.stream = null
  },
  consentDialog (state, { handleDTO, on }) {
    handleDTO.consentDialog = on
  },
  webrtcState (state, { handleDTO, on, reason }) {
    handleDTO.webrtcState = on
    handleDTO.webrtcStateReason = reason
  },
  iceState (state, { handleDTO, on }) {
    handleDTO.iceState = on
  },
  mediaState (state, { handleDTO, type, on }) {
    handleDTO.mediaState[type] = on
  },
  slowLink (state, { handleDTO, on }) {
    handleDTO.slowLink = on
  },
  onlocalstream (state, { handleDTO, stream }) {
    handleDTO.stream = stream
    handleDTO.isLocal = true
  },
  onremotestream (state, { handleDTO, stream }) {
    handleDTO.stream = stream
    handleDTO.isLocal = false
  },
  ondataopen (state, { handleDTO }) {
    handleDTO.mediaState.data = true
  },
  oncleanup (state, { handleDTO }) {
    handleDTO.stream = null
  },

  updateIds (state, { handleDTO, msg }) {
    if (msg.id) {
      handleDTO.id = msg.id
    }
    if (msg.private_id) {
      handleDTO.private_id = msg.private_id
    }
    if (msg.display) {
      handleDTO.display = msg.display
    }
  }
}

export const actions = {
  ondata ({
    commit,
    dispatch
  }, { handleDTO, data }) {
    // TODO: Add data handling
  },
  async onmessage ({
    commit,
    dispatch
  }, { handleDTO, msg, jsep }) {
    console.log(msg)
    if (msg.videoroom === 'joined') {
      this.$Janus.log('onmessage:joined')
      await dispatch('handleJoined', { handleDTO, msg })
    }
    if (msg.joining) {
      this.$Janus.log('onmessage:joining')
      await dispatch('handleJoining', { handleDTO, joining: msg.joining })
    }
    if (msg.videoroom === 'attached') {
      this.$Janus.log('onmessage:attached')
      await dispatch('handleAttached', { handleDTO, msg })
    }
    if (msg.publishers && msg.publishers.length) {
      this.$Janus.log('onmessage:publishers')
      await dispatch('handlePublishers', { handleDTO, publishers: msg.publishers })
    }
    if (msg.attendees && msg.attendees.length) {
      this.$Janus.log('onmessage:attendees')
      await dispatch('handleAttendees', { handleDTO, attendees: msg.attendees })
    }
    if (msg.configured === 'ok') {
      this.$Janus.log('onmessage:configured')
      await dispatch('handleConfigured', { handleDTO })
    }
    if (msg.unpublished) {
      this.$Janus.log('onmessage:unpublished')
      await dispatch('handleUnpublished', { handleDTO, leaving: msg.unpublished })
    }
    if (msg.leaving) {
      this.$Janus.log('onmessage:leaving')
      await dispatch('handleLeaving', { handleDTO, leaving: msg.leaving })
    }
    if (jsep) {
      await dispatch('handleJsep', { handleDTO, jsep })
    }
    if (msg.videoroom === 'destroyed') {
      this.$Janus.log('onmessage:destroyed')
      await dispatch('handleDestroyed', { handleDTO })
    }
    if (msg.error) {
      this.$Janus.log('onmessage:error')
      await dispatch('handleError', { handleDTO, error: msg.error })
    }
  },

  handleJoined ({
    commit,
    dispatch
  }, { handleDTO, msg }) {
    this.$Janus.log('handleJoined')
    commit('updateIds', { handleDTO, msg })
    if (handleDTO.sendAudio || handleDTO.sendVideo) {
      dispatch('api/janus/handle/createOffer', { handleDTO }, { root: true })
        .then(jsep => dispatch('api/janus/videoroom/api/configure', { handleDTO, jsep }, { root: true }))
    }
  },
  handleJoining ({
    commit,
    dispatch
  }, { handleDTO, joining }) {
    this.$Janus.log('handleJoining')
    const id = joining.id
    const display = joining.display
    const args = {
      plugin: handleDTO.plugin,
      roomid: handleDTO.roomid,
      display,
      ptype: 'attendee',
      id
    }
    dispatch('api/janus/handle/attachAttendee', { sessionDTO: handleDTO.sessionDTO, args }, { root: true })
  },
  handleAttached ({
    commit,
    dispatch
  }, { handleDTO, msg }) {
    this.$Janus.log('handleAttached')
    commit('updateIds', { handleDTO, msg })
  },
  handlePublishers ({
    commit,
    dispatch
  }, { handleDTO, publishers }) {
    for (const p in publishers) {
      const id = publishers[p].id
      const display = publishers[p].display
      const audioCodec = publishers[p].audio_codec
      const videoCodec = publishers[p].video_codec
      const args = {
        plugin: handleDTO.plugin,
        roomid: handleDTO.roomid,
        display,
        ptype: 'subscriber',
        id,

        sendAudio: handleDTO.sendAudio,
        sendVideo: handleDTO.sendVideo,
        sendData: handleDTO.sendData,
        sendScreen: handleDTO.sendScreen,

        receiveAudio: handleDTO.receiveAudio,
        receiveVideo: handleDTO.receiveVideo,
        receiveData: handleDTO.receiveData,
        audioCodec,
        videoCodec
      }
      dispatch('api/janus/handle/attachSubscriber', { sessionDTO: handleDTO.sessionDTO, args }, { root: true })
        .then(newHandleDTO => dispatch('api/janus/videoroom/api/joinSubscriber', { handleDTO: newHandleDTO }, { root: true }))
    }
  },

  handleAttendees ({
    commit,
    dispatch
  }, { handleDTO, attendees }) {
    for (const a in attendees) {
      const id = attendees[a].id
      const display = attendees[a].display
      const args = {
        plugin: handleDTO.plugin,
        roomid: handleDTO.roomid,
        display,
        ptype: 'subscriber',
        id
      }
      dispatch('api/janus/handle/attachAttendee', { sessionDTO: handleDTO.sessionDTO, args }, { root: true })
    }
  },

  handleConfigured ({
    commit
  }, { handleDTO }) {
    this.$Janus.log('Configuration has finished')
  },

  handleUnpublished ({
    commit,
    dispatch
  }, { handleDTO, unpublished }) {
    if (unpublished === 'ok') {
      commit('clearStream', { handleDTO })
    } else {
      const foundHandleDTO = handleDTO.sessionDTO.handleDTOs.find(h => h.id === unpublished)
      if (foundHandleDTO) {
        commit('clearStream', { handleDTO: foundHandleDTO })
      }
    }
  },

  async handleLeaving ({
    commit,
    dispatch
  }, { handleDTO, leaving }) {
    if (leaving === 'ok') {
      commit('clearStream', { handleDTO })
    } else {
      const foundHandleDTO = handleDTO.sessionDTO.handleDTOs.find(h => h.id === leaving)
      if (foundHandleDTO) {
        await dispatch('api/janus/handle/detach', { handleDTO: foundHandleDTO }, { root: true })
        commit('api/janus/handle/pull', { sessionDTO: foundHandleDTO.sessionDTO, handleDTO: foundHandleDTO }, { root: true })
      }
    }
  },

  handleJsep ({
    commit,
    dispatch
  }, { handleDTO, jsep }) {
    this.$Janus.log('handleJsep')
    if (handleDTO.isPublisher) {
      this.$Janus.log('handleRemoteJsep')
      handleDTO.handle.handleRemoteJsep({ jsep })
    } else {
      this.$Janus.log('createAnswer jsep')
      dispatch('api/janus/handle/createAnswer', { handleDTO, jsep }, { root: true })
        .then(jsepObj => dispatch('api/janus/videoroom/api/start', { handleDTO, jsep: jsepObj }, { root: true }))
    }
  },

  handleDestroyed ({
    commit,
    dispatch
  }, { handleDTO, jsep }) {
    this.$Janus.log('handleDestroyed')
    // TODO: Add cleanup
  },

  handleError ({
    commit,
    dispatch
  }, { handleDTO, error }) {
    this.$Janus.log(`JANUS ERROR: ${error}`)
    // TODO: Add proper housekeeping logic
  }
}