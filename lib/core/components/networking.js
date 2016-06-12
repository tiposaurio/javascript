'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _superagent = require('superagent');

var _superagent2 = _interopRequireDefault(_superagent);

var _superagentLogger = require('superagent-logger');

var _superagentLogger2 = _interopRequireDefault(_superagentLogger);

var _index = require('./cryptography/index');

var _index2 = _interopRequireDefault(_index);

var _responders = require('../presenters/responders');

var _responders2 = _interopRequireDefault(_responders);

var _config = require('./config.js');

var _config2 = _interopRequireDefault(_config);

var _utils = require('../utils');

var _utils2 = _interopRequireDefault(_utils);

var _flow_interfaces = require('../flow_interfaces');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _class = function () {
  function _class(_ref) {
    var config = _ref.config;
    var crypto = _ref.crypto;
    var sendBeacon = _ref.sendBeacon;

    _classCallCheck(this, _class);

    this._config = config;
    this._crypto = crypto;
    this._sendBeacon = sendBeacon;

    this._r = new _responders2.default('#networking');

    this._maxSubDomain = 20;
    this._currentSubDomain = Math.floor(Math.random() * this._maxSubDomain);

    this._providedFQDN = (config.isSslEnabled() ? 'https://' : 'http://') + config.getOrigin();
    this._coreParams = {};

    this.shiftStandardOrigin(false);
    this.shiftSubscribeOrigin(false);
  }

  _createClass(_class, [{
    key: 'nextOrigin',
    value: function nextOrigin(failover) {
      if (this._providedFQDN.indexOf('pubsub.') === -1) {
        return this._providedFQDN;
      }

      var newSubDomain = void 0;

      if (failover) {
        newSubDomain = _utils2.default.generateUUID().split('-')[0];
      } else {
        this._currentSubDomain = this._currentSubDomain + 1;

        if (this._currentSubDomain >= this._maxSubDomain) {
          this._currentSubDomain = 1;
        }

        newSubDomain = this._currentSubDomain.toString();
      }

      return this._providedFQDN.replace('pubsub', 'ps' + newSubDomain);
    }
  }, {
    key: 'shiftStandardOrigin',
    value: function shiftStandardOrigin() {
      var failover = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

      this._standardOrigin = this.nextOrigin(failover);

      return this._standardOrigin;
    }
  }, {
    key: 'shiftSubscribeOrigin',
    value: function shiftSubscribeOrigin() {
      var failover = arguments.length <= 0 || arguments[0] === undefined ? false : arguments[0];

      this._subscribeOrigin = this.nextOrigin(failover);

      return this._subscribeOrigin;
    }
  }, {
    key: 'performHeartbeat',
    value: function performHeartbeat(channels, incomingData, callback) {
      if (!this._config.getSubscribeKey()) {
        return callback(this._r.validationError('Missing Subscribe Key'));
      }

      var data = this.prepareParams(incomingData);

      var url = [this.getStandardOrigin(), 'v2', 'presence', 'sub-key', this._config.getSubscribeKey(), 'channel', channels, 'heartbeat'];

      if (this._config.getAuthKey()) {
        data.auth = this._config.getAuthKey();
      }

      if (this._config.getUUID()) {
        data.uuid = this._config.getUUID();
      }

      if (this._config.isRequestIdEnabled()) {
        data.requestid = _utils2.default.generateUUID();
      }

      this._xdr({ data: data, callback: callback, url: url });
    }
  }, {
    key: 'performLeave',
    value: function performLeave(channel, incomingData, callback) {
      if (!this._config.getSubscribeKey()) {
        return callback(this._r.validationError('Missing Subscribe Key'));
      }

      var data = this.prepareParams(incomingData);
      var origin = this.nextOrigin(false);
      var url = [origin, 'v2', 'presence', 'sub_key', this._config.getSubscribeKey(), 'channel', _utils2.default.encode(channel), 'leave'];

      if (this._config.getAuthKey()) {
        data.auth = this._config.getAuthKey();
      }

      if (this._config.getUUID()) {
        data.uuid = this._config.getUUID();
      }

      if (this._config.useSendBeacon && this._sendBeacon) {
        this._sendBeacon(_utils2.default.buildURL(url, data));
      } else {
        this._xdr({ data: data, callback: callback, url: url });
      }
    }
  }, {
    key: 'fetchHereNow',
    value: function fetchHereNow(channel, channelGroup, incomingData, callback) {
      if (!this._config.getSubscribeKey()) {
        return callback(this._r.validationError('Missing Subscribe Key'));
      }

      var data = this.prepareParams(incomingData);

      if (this._config.getUUID()) {
        data.uuid = this._config.getUUID();
      }

      if (this._config.getAuthKey()) {
        data.auth = this._config.getAuthKey();
      }

      var url = [this.getStandardOrigin(), 'v2', 'presence', 'sub-key', this._config.getSubscribeKey()];

      if (channel) {
        url.push('channel');
        url.push(_utils2.default.encode(channel));
      }

      if (channelGroup && !channel) {
        url.push('channel');
        url.push(',');
      }

      this._xdr({ data: data, callback: callback, url: url });
    }
  }, {
    key: 'performSubscribe',
    value: function performSubscribe(channels, incomingData, callback) {
      if (!this._config.getSubscribeKey()) {
        return callback(this._r.validationError('Missing Subscribe Key'));
      }

      var url = [this.getSubscribeOrigin(), 'v2', 'subscribe', this._config.getSubscribeKey(), _utils2.default.encode(channels), 0];

      var data = this.prepareParams(incomingData);

      if (this._config.getUUID()) {
        data.uuid = this._config.getUUID();
      }

      if (this._config.getAuthKey()) {
        data.auth = this._config.getAuthKey();
      }

      var timeout = this._config.getSubscribeTimeout();

      return this._xdr({ data: data, callback: callback, url: url, timeout: timeout });
    }
  }, {
    key: 'getStandardOrigin',
    value: function getStandardOrigin() {
      return this._standardOrigin;
    }
  }, {
    key: 'getSubscribeOrigin',
    value: function getSubscribeOrigin() {
      return this._subscribeOrigin;
    }
  }, {
    key: 'POST',
    value: function POST(params, body, endpoint, callback) {
      var superagentConstruct = _superagent2.default.post(this.getStandardOrigin() + endpoint.url).query(params).send(body);
      return this._abstractedXDR(superagentConstruct, endpoint.timeout, callback);
    }
  }, {
    key: 'GET',
    value: function GET(params, endpoint, callback) {
      var superagentConstruct = _superagent2.default.get(this.getStandardOrigin() + endpoint.url).query(params);
      return this._abstractedXDR(superagentConstruct, endpoint.timeout, callback);
    }
  }, {
    key: '_abstractedXDR',
    value: function _abstractedXDR(superagentConstruct, timeout, callback) {
      return superagentConstruct.type('json').use((0, _superagentLogger2.default)({ outgoing: true, timestamp: true })).timeout(timeout || this._config.getTransactionTimeout()).end(function (err, resp) {
        var status = {};
        status.error = err;

        if (err) {
          return callback(status, null);
        }

        var parsedResponse = JSON.parse(resp.text);
        return callback(status, parsedResponse);
      });
    }
  }]);

  return _class;
}();

exports.default = _class;
module.exports = exports['default'];