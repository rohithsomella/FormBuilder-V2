//
// Duplicate API Key Validation & Auto-Fix
//
var appSettings = null;

(function loadAppSettings() {
    try {
        fetch('../../config/appsettings.json')
            .then(function(res) { return res.json(); })
            .then(function(data) { appSettings = data; })
            .catch(function() { appSettings = {}; });
    } catch (e) {
        appSettings = {};
    }
})();

function isSettingEnabled(setting) {
    return appSettings && appSettings[setting] === true;
}

var AUTO_FIX_TYPES = ['columns', 'container', 'panel', 'htmlelement'];

function findDuplicateKeys(components, path, collected) {
    if (!components || !Array.isArray(components)) return collected;

    components.forEach(function(comp) {
        if (!comp) return;

        var label = comp.label || comp.key || 'Unknown';
        var currentPath = path + ' > ' + label;
        var key = comp.key;
        var type = comp.type;

        if (key) {
            if (!collected[key]) {
                collected[key] = [];
            }
            collected[key].push({ path: currentPath, type: type });
        }

        if (comp.components && Array.isArray(comp.components)) {
            if (comp.type === 'tabs') {
                comp.components.forEach(function(tab) {
                    if (tab.components && Array.isArray(tab.components)) {
                        findDuplicateKeys(tab.components, currentPath + ' > ' + (tab.label || tab.key), collected);
                    }
                });
            } else {
                findDuplicateKeys(comp.components, currentPath, collected);
            }
        }

        if (comp.columns && Array.isArray(comp.columns)) {
            comp.columns.forEach(function(col, colIndex) {
                if (col.components && Array.isArray(col.components)) {
                    findDuplicateKeys(col.components, currentPath + ' > Column ' + (colIndex + 1), collected);
                }
            });
        }

        if (comp.rows && Array.isArray(comp.rows)) {
            comp.rows.forEach(function(row, rowIndex) {
                if (Array.isArray(row)) {
                    row.forEach(function(cell, cellIndex) {
                        if (cell.components && Array.isArray(cell.components)) {
                            findDuplicateKeys(cell.components, currentPath + ' > Row ' + (rowIndex + 1) + ' Cell ' + (cellIndex + 1), collected);
                        }
                    });
                }
            });
        }
    });

    return collected;
}

function validateAndAutoFixKeys(builderInstance) {
    if (!isSettingEnabled('autoGenerateIDsForLayouts') && !isSettingEnabled('listOutDuplicateIds')) {
        return null;
    }

    var formComponents = builderInstance.webform._form.components;
    if (!formComponents || !Array.isArray(formComponents)) return null;

    var collected = {};
    findDuplicateKeys(formComponents, 'Root', collected);

    var toFix = {};
    var toError = {};
    var fixedCount = 0;

    for (var key in collected) {
        if (!collected.hasOwnProperty(key) || collected[key].length <= 1) continue;

        var allLayout = collected[key].every(function(item) {
            return AUTO_FIX_TYPES.indexOf(item.type) !== -1;
        });

        if (allLayout && isSettingEnabled('autoGenerateIDsForLayouts')) {
            toFix[key] = collected[key];
        } else if (isSettingEnabled('listOutDuplicateIds')) {
            toError[key] = collected[key];
        }
    }

    if (Object.keys(toFix).length > 0) {
        var counters = {};
        FormioUtils.eachComponent(formComponents, function(component) {
            if (toFix.hasOwnProperty(component.key)) {
                if (!counters[component.key]) counters[component.key] = 1;
                component.key = component.key + counters[component.key];
                counters[component.key]++;
                fixedCount++;
            }
        }, true);

        if (fixedCount > 0) {
            alert('Auto-fixed ' + fixedCount + ' layout component duplicate key(s).\n' +
                  'Components of type: ' + AUTO_FIX_TYPES.join(', ') + ' were updated.\n' +
                  'Please save again to confirm.');
        }
    }

    return Object.keys(toError).length > 0 ? toError : null;
}

function autoFixAllDuplicateKeys(builderInstance, duplicates) {
    var formComponents = builderInstance.webform._form.components;
    if (!formComponents) return;

    var counters = {};
    var fixedCount = 0;

    FormioUtils.eachComponent(formComponents, function(component) {
        var key = component.key;
        if (duplicates.hasOwnProperty(key)) {
            counters[key] = (counters[key] || 0) + 1;
            if (counters[key] > 1) {
                component.key = key + (counters[key] - 1);
                fixedCount++;
            }
        }
    }, true);

    if (fixedCount > 0) {
        alert('Auto-fixed ' + fixedCount + ' duplicate key(s).\nFirst occurrence kept as-is, duplicates suffixed with 1, 2, ...\nPlease save again.');
    }
}

function showDuplicateKeyError(duplicates, builderInstance) {
    $('#duplicateKeysModal').remove();

    var bodyHtml = '<p>These duplicate API Keys need to be resolved:</p><ul>';
    for (var key in duplicates) {
        if (duplicates.hasOwnProperty(key)) {
            bodyHtml += '<li><strong>"' + key + '"</strong> found at:<ul>';
            duplicates[key].forEach(function(item) {
                bodyHtml += '<li>' + item.path + ' (' + item.type + ')</li>';
            });
            bodyHtml += '</ul></li>';
        }
    }
    bodyHtml += '</ul>';

    var showModifyBtn = isSettingEnabled('autoGenerateIds');

    var footerBtns = showModifyBtn
        ? '<button type="button" class="btn btn-primary" id="modifyDupBtn">Modify Duplicate IDs</button>' +
          '<button type="button" class="btn btn-secondary" data-dismiss="modal">OK</button>'
        : '<button type="button" class="btn btn-secondary" data-dismiss="modal">OK</button>';

    var modalHtml =
        '<div class="modal fade" id="duplicateKeysModal" tabindex="-1" role="dialog">' +
          '<div class="modal-dialog modal-lg" role="document">' +
            '<div class="modal-content">' +
              '<div class="modal-header">' +
                '<h5 class="modal-title">Duplicate API Keys Found</h5>' +
                '<button type="button" class="close" data-dismiss="modal">&times;</button>' +
              '</div>' +
              '<div class="modal-body">' + bodyHtml + '</div>' +
              '<div class="modal-footer">' + footerBtns + '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

    $('body').append(modalHtml);
    $('#duplicateKeysModal').modal('show');

    if (showModifyBtn) {
        $('#modifyDupBtn').on('click', function() {
            autoFixAllDuplicateKeys(builderInstance, duplicates);
            $('#duplicateKeysModal').modal('hide');
        });
    }
}
