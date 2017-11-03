/* global _ Bloodhound */
define(['app', 'handlebars', 'core/UIView', 'utils'], function (app, Handlebars, UIView, Utils) {
  'use strict';

  // @TODO: this should be a great feature on Models
  function getMultipleAttributes(model, attributes) {
    if (attributes && attributes.length > 0) {
      var columns = attributes.split(',');
      var values = [];
      _.each(columns, function (column) {
        values.push(model.get(column));
      });

      return values.join(' ');
    }
  }

  return UIView.extend({
    events: {
      'click .clear': function () {
        var model = this.model.get(this.name);
        var table = model.table;

        model.clear();

        if (table && table.getPrimaryColumnName()) {
          model.set(table.getPrimaryColumnName(), null);
        }

        this.model.set(this.name, model);
        this.render();
      }
    },

    template: 'many_to_one_typeahead/input',

    serialize: function () {
      var relatedModel = this.model.get(this.name);

      return {
        name: this.options.name,
        size: this.columnSchema.options.get('size'),
        readOnly: this.options.settings.get('read_only') || !this.options.canWrite,
        disabled: !this.visibleColumn,
        selectedItem: relatedModel,
        hasSelectedItem: !relatedModel.isNew(),
        comment: this.options.schema.get('comment'),
        selectedValue: this.getSelectedValue()
      };
    },

    encodeQueryParams: function (data) {
      var params = [];

      _.each(data, function (value, key) {
        params.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      });

      return params.join('&');
    },

    afterRender: function () {
      var self = this;
      var url = app.API_URL + 'tables/' + this.collection.table.id + '/typeahead/';
      var model = this.model.get(this.name);
      var params = {};

      if (this.visibleColumn) {
        params.columns = this.visibleColumn;
      }

      var status = 1;
      if (this.options.settings.get('visible_status_ids')) {
        status = this.options.settings.get('visible_status_ids');
      }

      if (model.table.hasStatusColumn()) {
        params[model.table.getStatusColumnName()] = status;
      }

      var urlParams = this.encodeQueryParams(params);
      if (urlParams) {
        url += '?' + urlParams;
      }

      var fetchItems = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.obj.whitespace('value'),
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        prefetch: {
          url: url,
          ttl: 0
        },
        remote: url + '&q=' + encodeURIComponent('%QUERY'),
        dupDetector: function (remoteMatch, localMatch) {
          return remoteMatch.value === localMatch.value;
        }
      });

      if (this.visibleColumn) {
        fetchItems.initialize();
        // FetchItems.clearPrefetchCache();
        // engine.clearRemoteCache();
        this.$('.for_display_only').typeahead({
          minLength: 1,
          items: 5
        }, {
          source: fetchItems.ttAdapter()
        });
      }

      this.$('.for_display_only').on('typeahead:selected', function (e, datum) {
        var model = self.model.get(self.name);
        var selectedId = parseInt(datum.id, 10);

        model.clear();
        model.setId(selectedId);
        model.fetch({success: function () {
          self.updateSelectedValue();
          self.render();
          // Clear after fetch
          model.clear();
          model.setId(selectedId);
        }});
      });
    },

    getSelectedValue: function () {
      var relatedModel = this.model.get(this.name);
      var templateSource = this.columnSchema.options.get('template');
      var selectedValue = this.visibleColumn ? getMultipleAttributes(relatedModel, this.visibleColumn) : '';

      if (templateSource && !relatedModel.isNew()) {
        var template = Handlebars.compile(templateSource);
        selectedValue = template(relatedModel.toJSON());
      }

      return selectedValue;
    },

    updateSelectedValue: function () {
      var value = this.model.get(this.name);

      this.model.set(this.name, value);
      this.$el.find('#selectedValue').html(this.getSelectedValue());
    },

    initialize: function () {
      this.visibleColumn = Utils.parseCSV(this.columnSchema.options.get('visible_column')).join(',');
      this.includeInactives = this.columnSchema.options.get('include_inactive');
      var value = this.model.get(this.name);
      this.collection = value.collection.getNewInstance({omit: ['preferences']});
    }
  });
});
