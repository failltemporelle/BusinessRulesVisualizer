var UserVisualizerService = Class.create();
UserVisualizerService.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {

    searchUsers: function () {
        var query = this.getParameter('sysparm_query');
        if (!query) return JSON.stringify([]);

        try {
            var users = [];
            var gr = new GlideRecord('sys_user');
            var qc = gr.addQuery('name', 'CONTAINS', query);
            qc.addOrCondition('user_name', 'CONTAINS', query);
            gr.orderBy('name');
            gr.setLimit(20);
            gr.query();

            while (gr.next()) {
                if (!gr.canRead()) continue;
                users.push({
                    value: gr.getValue('sys_id'),
                    label: gr.getValue('name') + ' (' + gr.getValue('user_name') + ')',
                    user_name: gr.getValue('user_name')
                });
            }

            return JSON.stringify(users);
        } catch (e) {
            return JSON.stringify({ error: e.message });
        }
    },

    getUserItems: function () {
        var userId = this.getParameter('sysparm_user_id');
        var userName = this.getParameter('sysparm_user_name');
        
        if (!userId || !userName) {
            return JSON.stringify({ error: 'Missing sysparm_user_id or sysparm_user_name parameter' });
        }

        try {
            var items = {
                created: [],
                assigned: []
            };

            // 1. Fetch created items (from sys_metadata)
            // Note: sys_metadata can be large, we'll limit it to 100 recent ones to avoid big performance hits.
            var grMeta = new GlideRecord('sys_metadata');
            grMeta.addQuery('sys_created_by', userName);
            grMeta.orderByDesc('sys_created_on');
            grMeta.setLimit(100);
            grMeta.query();

            // We'll use GlideRecordUtil to get display values if needed, or simply class name.
            while (grMeta.next()) {
                if (!grMeta.canRead()) continue;
                items.created.push({
                    sys_id: grMeta.getValue('sys_id'),
                    name: grMeta.getValue('sys_name') || grMeta.getValue('name') || '(empty)',
                    sys_class_name: grMeta.getValue('sys_class_name'),
                    class_display: grMeta.getDisplayValue('sys_class_name') || grMeta.getValue('sys_class_name'),
                    created_on: grMeta.getValue('sys_created_on'),
                    updated_on: grMeta.getValue('sys_updated_on')
                });
            }

            // 2. Fetch assigned items (from task)
            var grTask = new GlideRecord('task');
            grTask.addQuery('assigned_to', userId);
            grTask.addActiveQuery(); // Only active tasks
            grTask.orderByDesc('sys_created_on');
            grTask.setLimit(100);
            grTask.query();

            while (grTask.next()) {
                if (!grTask.canRead()) continue;
                items.assigned.push({
                    sys_id: grTask.getValue('sys_id'),
                    number: grTask.getValue('number'),
                    short_description: grTask.getValue('short_description') || '',
                    sys_class_name: grTask.getValue('sys_class_name'),
                    class_display: grTask.getDisplayValue('sys_class_name') || grTask.getValue('sys_class_name'),
                    state: grTask.getDisplayValue('state') || grTask.getValue('state')
                });
            }

            return JSON.stringify(items);
        } catch (e) {
            return JSON.stringify({ error: e.message });
        }
    },

    getRecentUsers: function () {
        var pref = gs.getUser().getPreference('x_1118332_brv.recent_users');
        if (!pref) {
            return JSON.stringify([]);
        }
        try {
            return pref; // already a JSON string
        } catch (e) {
            return JSON.stringify([]);
        }
    },

    saveUserPreference: function () {
        // Here we expect a string containing stringified object { value: sys_id, label: name, user_name: user_name }
        var userStr = this.getParameter('sysparm_user');
        if (!userStr) {
            return JSON.stringify({ success: false, error: 'Missing sysparm_user' });
        }

        try {
            var newEntry = JSON.parse(userStr);
            var existing = this._getRecentUsersArray();

            // Remove the user if already present, then prepend
            existing = existing.filter(function (u) { return u.value !== newEntry.value; });
            existing.unshift(newEntry);

            // Keep max 10 entries
            if (existing.length > 10) {
                existing = existing.slice(0, 10);
            }

            gs.getUser().savePreference('x_1118332_brv.recent_users', JSON.stringify(existing));
            return JSON.stringify({ success: true });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.message });
        }
    },

    deleteUserPreference: function () {
        var userId = this.getParameter('sysparm_user_id');
        if (!userId) {
            return JSON.stringify({ success: false, error: 'Missing sysparm_user_id' });
        }

        try {
            var existing = this._getRecentUsersArray();

            existing = existing.filter(function (u) { return u.value !== userId; });
            gs.getUser().savePreference('x_1118332_brv.recent_users', JSON.stringify(existing));
            return JSON.stringify({ success: true });
        } catch (e) {
            return JSON.stringify({ success: false, error: e.message });
        }
    },

    _getRecentUsersArray: function () {
        var existing = [];
        var pref = gs.getUser().getPreference('x_1118332_brv.recent_users');
        if (pref) {
            try {
                existing = JSON.parse(pref);
            } catch (e) {
                existing = [];
            }
        }
        return existing;
    },

    type: 'UserVisualizerService'
});
