"use strict";
Component({
  data: {
    ctrl: {},
    isiOS: wx.getSystemInfoSync().system.includes("iOS")
  },
  properties: {
    childs: Array,
    opts: Array
  },
  options: {
    addGlobalClass: true
  },
  attached: function() {
    this.triggerEvent("add", this, { bubbles: true, composed: true });
  },
  methods: {
    noop: function() {},
    getNode: function(selector) {
      try {
        var parts = selector.split("_");
        var node = this.data.childs[parts[0]];
        for (var i = 1; i < parts.length; i++) {
          node = node.children[parts[i]];
        }
        return node;
      } catch (e) {
        return { text: "", attrs: {}, children: [] };
      }
    },
    play: function(e) {
      var idx = e.target.dataset.i;
      var node = this.getNode(idx);
      var attrs = Object.assign({}, node.attrs, { src: node.src[this.data.ctrl[idx] || 0] });
      this.root.triggerEvent("play", { source: node.name, attrs: attrs });
      if (this.root.data.pauseVideo) {
        var videoId = e.target.id;
        var isPlaying = false;
        for (var i = this.root._videos.length - 1; i >= 0; i--) {
          if (this.root._videos[i].id === videoId) {
            isPlaying = true;
          } else {
            this.root._videos[i].pause();
          }
        }
        if (!isPlaying) {
          var video = wx.createVideoContext(videoId, this);
          video.id = videoId;
          if (this.root.playbackRate) {
            video.playbackRate(this.root.playbackRate);
          }
          this.root._videos.push(video);
        }
      }
    },
    imgTap: function(e) {
      var node = this.getNode(e.target.dataset.i);
      if (node.a) {
        this.linkTap(node.a);
        return;
      }
      if (!node.attrs.ignore) {
        this.root.triggerEvent("imgtap", node.attrs);
        if (this.root.data.previewImg) {
          var img = this.root.imgList[node.i];
          wx.previewImage({
            showmenu: this.root.data.showImgMenu,
            current: img,
            urls: this.root.imgList
          });
        }
      }
    },
    imgLoad: function(e) {
      var idx = e.target.dataset.i;
      var node = this.getNode(idx);
      var width;
      if (node.w) {
        if (this.data.opts[1] && !this.data.ctrl[idx] || this.data.ctrl[idx] === -1) {
          width = 1;
        }
      } else {
        width = e.detail.width;
      }
      if (width) {
        var obj = {};
        obj["ctrl." + idx] = width;
        this.setData(obj);
      }
      this.checkReady();
    },
    checkReady: function() {
      var that = this;
      if (!this.root.data.lazyLoad) {
        this.root.imgList._unloadimgs -= 1;
        if (!this.root.imgList._unloadimgs) {
          setTimeout(function() {
            that.root.getRect().then(function(rect) {
              that.root.triggerEvent("ready", rect);
            }).catch(function() {
              that.root.triggerEvent("ready", {});
            });
          }, 350);
        }
      }
    },
    linkTap: function(e) {
      var node = e.currentTarget ? this.getNode(e.currentTarget.dataset.i) : {};
      var attrs = node.attrs || e;
      var href = attrs.href;
      var text = this.root.getText(node.children || []);
      this.root.triggerEvent("linktap", Object.assign({ innerText: text }, attrs));
      if (href) {
        if (href[0] === "#") {
          this.root.navigateTo(href.substring(1)).catch(function() {});
        } else if (href.split("?")[0].includes("://")) {
          if (this.root.data.copyLink) {
            wx.setClipboardData({
              data: href,
              success: function() {
                wx.showToast({ title: "链接已复制" });
              }
            });
          }
        } else {
          wx.navigateTo({
            url: href,
            fail: function() {
              wx.switchTab({
                url: href,
                fail: function() {}
              });
            }
          });
        }
      }
    },
    mediaError: function(e) {
      var idx = e.target.dataset.i;
      var node = this.getNode(idx);
      if (node.name === "video" || node.name === "audio") {
        var next = (this.data.ctrl[idx] || 0) + 1;
        if (next >= node.src.length) {
          next = 0;
        }
        if (next < node.src.length) {
          var obj = {};
          obj["ctrl." + idx] = next;
          this.setData(obj);
        }
      } else if (node.name === "img") {
        if (this.data.opts[2]) {
          var obj = {};
          obj["ctrl." + idx] = -1;
          this.setData(obj);
        }
        this.checkReady();
      }
      if (this.root) {
        this.root.triggerEvent("error", { source: node.name, attrs: node.attrs, errMsg: e.detail.errMsg });
      }
    }
  }
});
