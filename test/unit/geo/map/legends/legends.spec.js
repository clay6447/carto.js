var Backbone = require('backbone');
var Legends = require('../../../../../src/geo/map/legends/legends');

describe('geo/map/legends/legends', function () {
  beforeEach(function () {
    this.visModel = new Backbone.Model();
    this.legends = new Legends([
      {
        type: 'bubble',
        title: 'Bubble Legend',
        pre_html: '<p>PRE Bubble Legend</p>',
        post_html: '<p>POST Bubble Legend</p>',
        definition: {
          color: '#FABADA'
        }
      },
      {
        type: 'category',
        title: 'Categories Legend',
        pre_html: '<p>PRE Category Legend</p>',
        post_html: '<p>POST Category Legend</p>',
        definition: {
          prefix: 'prefix',
          suffix: 'suffix'
        }
      },
      {
        type: 'choropleth',
        title: 'Choropleth Legend',
        pre_html: '<p>PRE Choropleth Legend</p>',
        post_html: '<p>POST Choropleth Legend</p>',
        definition: {
          prefix: 'prefix',
          suffix: 'suffix'
        }
      },
      {
        type: 'custom',
        title: 'Custom Legend',
        pre_html: '<p>PRE Custom Legend</p>',
        post_html: '<p>POST Custom Legend</p>',
        definition: {
          categories: [
            { type: 'color', name: 'Item 1', color: '#CACACA;' },
            { type: 'color', name: 'Item 2', color: '#FABADA;' }
          ]
        }
      },
      {
        type: 'html',
        title: 'HTML Legend',
        definition: {
          html: '<p>Some markup that gets sanitised<script>alert("hola");<\/script></p>'
        }
      }
    ], {
      visModel: this.visModel
    });
  });

  it('should initialize bubble legends correctly', function () {
    expect(this.legends.bubble.get('title')).toEqual('Bubble Legend');
    expect(this.legends.bubble.get('preHTMLSnippet')).toEqual('<p>PRE Bubble Legend</p>');
    expect(this.legends.bubble.get('postHTMLSnippet')).toEqual('<p>POST Bubble Legend</p>');
    expect(this.legends.bubble.get('fillColor')).toEqual('#FABADA');
  });

  it('should initialize category legends correctly', function () {
    expect(this.legends.category.get('title')).toEqual('Categories Legend');
    expect(this.legends.category.get('preHTMLSnippet')).toEqual('<p>PRE Category Legend</p>');
    expect(this.legends.category.get('postHTMLSnippet')).toEqual('<p>POST Category Legend</p>');
    expect(this.legends.category.get('prefix')).toEqual('prefix');
    expect(this.legends.category.get('suffix')).toEqual('suffix');
  });

  it('should initialize choropleth legends correctly', function () {
    expect(this.legends.choropleth.get('title')).toEqual('Choropleth Legend');
    expect(this.legends.choropleth.get('preHTMLSnippet')).toEqual('<p>PRE Choropleth Legend</p>');
    expect(this.legends.choropleth.get('postHTMLSnippet')).toEqual('<p>POST Choropleth Legend</p>');
    expect(this.legends.choropleth.get('prefix')).toEqual('prefix');
    expect(this.legends.choropleth.get('suffix')).toEqual('suffix');
  });

  it('should initialize custom legends correctly', function () {
    expect(this.legends.custom.get('title')).toEqual('Custom Legend');
    expect(this.legends.custom.get('preHTMLSnippet')).toEqual('<p>PRE Custom Legend</p>');
    expect(this.legends.custom.get('postHTMLSnippet')).toEqual('<p>POST Custom Legend</p>');
    expect(this.legends.custom.get('items').length).toEqual(2);
  });

  it('should initialize HTML legends correctly', function () {
    expect(this.legends.html.get('title')).toEqual('HTML Legend');
    expect(this.legends.html.get('html')).toEqual('<p>Some markup that gets sanitised<script>alert("hola");<\/script></p>');
  });

  describe('binding to vis "reload" event', function () {
    it('should update legends states to loading', function () {
      this.legends.bubble.set('state', 'success');
      this.legends.category.set('state', 'success');
      this.legends.choropleth.set('state', 'success');

      expect(this.legends.bubble.isLoading()).toBeFalsy();
      expect(this.legends.category.isLoading()).toBeFalsy();
      expect(this.legends.choropleth.isLoading()).toBeFalsy();

      this.visModel.trigger('reload');

      expect(this.legends.bubble.isLoading()).toBeTruthy();
      expect(this.legends.category.isLoading()).toBeTruthy();
      expect(this.legends.choropleth.isLoading()).toBeTruthy();
    });
  });
});
