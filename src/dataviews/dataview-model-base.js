var _ = require('underscore');
var Model = require('../core/model');
var BackboneAbortSync = require('../util/backbone-abort-sync');
var AnalysisModel = require('../analysis/analysis-model');
var util = require('../core/util');
var parseWindshaftErrors = require('../windshaft/error-parser');

var UNFETCHED_STATUS = 'unfetched';
var FETCHING_STATUS = 'fetching';
var FETCHED_STATUS = 'fetched';
var FETCH_ERROR_STATUS = 'error';

var REQUIRED_OPTS = [
  'engine'
];

/**
 * Default dataview model
 */
module.exports = Model.extend({
  defaults: {
    url: '',
    data: [],
    sync_on_data_change: true,
    sync_on_bbox_change: true,
    enabled: true,
    status: UNFETCHED_STATUS
  },

  url: function () {
    var params = _.union(
      [ this._getBoundingBoxFilterParam() ],
      this._getDataviewSpecificURLParams()
    );

    if (this.get('apiKey')) {
      params.push('api_key=' + this.get('apiKey'));
    } else if (this.get('authToken')) {
      var authToken = this.get('authToken');
      if (authToken instanceof Array) {
        _.each(authToken, function (token) {
          params.push('auth_token[]=' + token);
        });
      } else {
        params.push('auth_token=' + authToken);
      }
    }
    return this.get('url') + '?' + params.join('&');
  },

  _getBoundingBoxFilterParam: function () {
    var result = '';

    this._checkBBoxFilter();
    if (this.syncsOnBoundingBoxChanges()) {
      result = 'bbox=' + this._bboxFilter.serialize();
    }

    return result;
  },

  /**
   * Subclasses might override this method to define extra params that will be appended
   * to the dataview's URL.
   * @return {Array} An array of strings in the form of "key=value".
   */
  _getDataviewSpecificURLParams: function () {
    return [];
  },

  initialize: function (attrs, opts) {
    attrs = attrs || {};
    opts = opts || {};
    util.checkRequiredOpts(opts, REQUIRED_OPTS, 'DataviewModelBase');

    this._engine = opts.engine;

    if (!attrs.source) throw new Error('source is a required attr');
    this._checkSourceAttribute(this.getSource());
    this.getSource().markAsSourceOf(this);

    if (!attrs.id) {
      this.set('id', this.defaults.type + '-' + this.cid);
    }

    this.sync = BackboneAbortSync.bind(this);

    // filter is optional, so have to guard before using it
    this.filter = opts.filter;
    if (this.filter) {
      this.filter.set('dataviewId', this.id);
    }

    if (opts.bboxFilter) {
      this.addBBoxFilter(opts.bboxFilter);
    }

    this._initBinds();
  },

  _initBinds: function () {
    this.listenToOnce(this, 'change:url', function () {
      this._checkBBoxFilter();
      if (this.syncsOnBoundingBoxChanges() && !this._bboxFilter.areBoundsAvailable()) {
        // wait until map gets bounds from view
        this.listenTo(this._bboxFilter, 'boundsChanged', this._initialFetch);
      } else {
        this._initialFetch();
      }
    });

    if (this.filter) {
      this.listenTo(this.filter, 'change', this._onFilterChanged);
    }

    this.getSource().on('change:status', this._onAnalysisStatusChange, this);
  },

  _onChangeBinds: function () {
    this.on('change:sync_on_bbox_change', function () {
      this.refresh();
    }, this);

    this._listenToBBoxChanges();

    this.on('change:url', function (model, value, opts) {
      if (this.syncsOnDataChanges()) {
        this._newDataAvailable = true;
      }
      if (this._shouldFetchOnURLChange(opts && _.pick(opts, ['forceFetch', 'sourceId']))) {
        this.fetch();
      }
    }, this);

    this.on('change:enabled', function (mdl, isEnabled) {
      if (isEnabled && this._newDataAvailable) {
        this.fetch();
        this._newDataAvailable = false;
      }
    }, this);
  },

  _onMapBoundsChanged: function () {
    if (this._shouldFetchOnBoundingBoxChange()) {
      this.fetch();
    }

    if (this.syncsOnBoundingBoxChanges()) {
      this._newDataAvailable = true;
    }
  },

  _initialFetch: function () {
    this.fetch({
      success: this._onChangeBinds.bind(this)
    });
  },

  _onAnalysisStatusChange: function (analysis, status) {
    if (analysis.isLoading()) {
      this._triggerLoading();
    } else if (analysis.isFailed()) {
      this._triggerStatusError(analysis.get('error'));
    }
    // loaded will be triggered through the default behavior, so not necessary to react on that status here
  },

  _triggerLoading: function () {
    this.trigger('loading', this);
  },

  _triggerStatusError: function (error) {
    this.trigger('statusError', this, error); // Backbone already emits an event `error` in failed requests. Avoiding name collision.
  },

  /**
   * @protected
   */
  _onFilterChanged: function (filter) {
    this._reload({
      sourceId: this.getSourceId()
    });
  },

  _reloadAndForceFetch: function () {
    this._reload({
      sourceId: this.getSourceId(),
      forceFetch: true
    });
  },

  _reload: function (opts) {
    opts = opts || {};
    this._engine.reload(opts);
  },

  _shouldFetchOnURLChange: function (options) {
    options = options || {};
    var sourceId = options.sourceId;
    var forceFetch = options.forceFetch;

    if (forceFetch) {
      return true;
    }

    return this.isEnabled() &&
      this.syncsOnDataChanges() &&
      this._sourceAffectsMyOwnSource(sourceId);
  },

  _sourceAffectsMyOwnSource: function (sourceId) {
    if (!sourceId) {
      return true;
    }
    var sourceAnalysis = this.getSource();
    return sourceAnalysis && sourceAnalysis.findAnalysisById(sourceId);
  },

  _shouldFetchOnBoundingBoxChange: function () {
    return this.isEnabled() &&
      this.syncsOnBoundingBoxChanges();
  },

  refresh: function () {
    this.fetch();
  },

  addBBoxFilter: function (bboxFilter) {
    if (!bboxFilter) {
      return;
    }
    this._stopListeningBBoxChanges();
    this._bboxFilter = bboxFilter;
    this._listenToBBoxChanges();
  },

  update: function (attrs) {
    if (_.has(attrs, 'source')) {
      throw new Error('Source of dataviews cannot be updated');
    }
    attrs = _.pick(attrs, this.constructor.ATTRS_NAMES);

    this.set(attrs);
  },

  getData: function () {
    return this.get('data');
  },

  getPreviousData: function () {
    return this.previous('data');
  },

  fetch: function (opts) {
    opts = opts || {};
    this.set('status', FETCHING_STATUS);

    this._triggerLoading();

    if (opts.success) {
      var successCallback = opts && opts.success;
    }

    return Model.prototype.fetch.call(this, _.extend(opts, {
      success: function () {
        this.set('status', FETCHED_STATUS);
        successCallback && successCallback(arguments);
        this.trigger('loaded', this);
      }.bind(this),
      error: function (_model, response) {
        if (!response || (response && response.statusText !== 'abort')) {
          this.set('status', FETCH_ERROR_STATUS);
          var error = this._parseAjaxError(response);
          this._triggerStatusError(error);
        }
      }.bind(this)
    }));
  },

  toJSON: function () {
    throw new Error('toJSON should be defined for each dataview');
  },

  getSourceType: function () {
    return this.getSource().get('type');
  },

  getSourceId: function () {
    var source = this.getSource();
    return source && source.id;
  },

  getSource: function () {
    return this.get('source');
  },

  isFiltered: function () {
    var isFiltered = false;
    if (this.filter) {
      isFiltered = !this.filter.isEmpty();
    }
    return isFiltered;
  },

  remove: function () {
    this._removeExistingAnalysisBindings();
    this.getSource().unmarkAsSourceOf(this);
    this.trigger('destroy', this);
    this.stopListening();
  },

  _removeExistingAnalysisBindings: function () {
    this.getSource().off('change:status', this._onAnalysisStatusChange, this);
  },

  isFetched: function () {
    return this.get('status') === FETCHED_STATUS;
  },

  isUnavailable: function () {
    return this.get('status') === FETCH_ERROR_STATUS;
  },

  isEnabled: function () {
    return this.get('enabled');
  },

  setUnavailable: function (error) {
    this._triggerError(error);
    return this.set('status', FETCH_ERROR_STATUS);
  },

  syncsOnDataChanges: function () {
    return this.get('sync_on_data_change');
  },

  syncsOnBoundingBoxChanges: function () {
    return this.get('sync_on_bbox_change');
  },

  _checkSourceAttribute: function (source) {
    if (!(source instanceof AnalysisModel)) {
      throw new Error('Source must be an instance of AnalysisModel');
    }
  },

  _checkBBoxFilter: function () {
    if (this.syncsOnBoundingBoxChanges() && !this._bboxFilter) {
      throw new Error('Cannot sync on bounding box changes. There is no bounding box filter.');
    }
  },

  _listenToBBoxChanges: function () {
    if (this._bboxFilter) {
      this.listenTo(this._bboxFilter, 'boundsChanged', this._onMapBoundsChanged);
    }
  },

  _stopListeningBBoxChanges: function () {
    if (this._bboxFilter) {
      this.stopListening(this._bboxFilter, 'boundsChanged');
    }
  },

  _parseAjaxError: function (response) {
    var error = response && response.statusText;
    if (response && response.responseJSON) {
      var errors = parseWindshaftErrors(response.responseJSON);
      if (errors.length > 0) {
        error = errors[0];
      }
    }
    return error;
  }
},

// Class props
{
  ATTRS_NAMES: [
    'id',
    'sync_on_data_change',
    'sync_on_bbox_change',
    'enabled',
    'source'
  ]
});
