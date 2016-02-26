var FormulaGeoJSONDataProvider = require('../../../../../src/geo/data-providers/geojson/formula-geojson-data-provider');

describe('src/geo/data-providers/geojson/formula-geojson-data-provider.js', function () {
  beforeEach(function () {
    this.vectorLayerView = jasmine.createSpyObj('vectorLayerView', ['_on', 'applyFilter']);
    var dataview = jasmine.createSpyObj('dataview', ['get']);
    dataview.get.and.callFake(function (attr) {
      if (attr === 'column') {
        return 'columnName';
      }
    });
    this.dataProvider = new FormulaGeoJSONDataProvider({
      dataview: dataview,
      vectorLayerView: this.vectorLayerView,
      layerIndex: 0
    });
  });

  describe('.getData', function () {
    it('should return the data', function () {
      // TODO: Test this
    });
  });
});
