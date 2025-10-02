'use strict';
'require dom';
'require fs';
'require form';
'require network';
'require rpc';
'require poll';
'require uci';
'require ui';
'require view';

let callNetworkDevices, callPseStatus, callPseRecovery, callPseToggle;

callNetworkDevices = rpc.declare({
	object: 'luci-rpc',
	method: 'getNetworkDevices',
	expect: { '': {} }
});

callPseStatus = rpc.declare({
	object: 'pse',
	method: 'get_poe_status',
	expect: { '': {} }
});

callPseRecovery = rpc.declare({
	object: 'pse',
	method: 'recovery',
	params: [ 'port' ],
	expect: { result: 'ok' }
});

callPseToggle = rpc.declare({
	object: 'pse',
	method: 'toggle',
	params: [ 'port' ],
	expect: { result: 'ok' }
});

return view.extend({

	load: function () {
		return Promise.all([
			callPseStatus(),
			callNetworkDevices()
		]);
	},

	handleSaveApply: function (ev, mode) {
		var Fn = L.bind(function() {
			fs.exec('/etc/init.d/pse-daemon', ['restart'])
			document.removeEventListener('uci-applied',Fn);
		});
		document.addEventListener('uci-applied', Fn);
		this.super('handleSaveApply', [ev, mode]);
	},

	render: function (data) {
		let status = data[0];
		let devices = data[1];

		var m, s, o;

		m = new form.Map('pse', 'PoE', _('PoE Manager'));

		s = m.section(form.NamedSection, 'power', 'power', _('Port Status'));
		s.render = L.bind(function(view /*, ... */) {
			return form.NamedSection.prototype.render.apply(this, this.varargs(arguments, 1))
				.then(L.bind(function(node) {
					node.appendChild(E('br'));

					let container = E('div', { style: 'display: flex; justify-content: space-between; width: 100%;' });
					let ports = [
						{name: "LAN 1", alt: "LAN 5", owname: 'lan5'},
						{name: "LAN 2", alt: "LAN 4", owname: 'lan4'},
						{name: "LAN 3", alt: "LAN 3", owname: 'lan3'},
						{name: "LAN 4", alt: "LAN 2", owname: 'lan2'},
					];

					ports.forEach(port => {
						let icon = 'ethernet';
						let obj = status.lanList.find(item => item.name === port.name);
						if (obj && obj.isNoPower == 0 && obj.power > 0) icon += '-poeout';
						if (devices[port.owname].link.speed == 100) icon += '-100';
						if (devices[port.owname].link.speed == 1000) icon += '-1000';
						let div = E('div', { style: 'flex: 1; display: flex; flex-direction: column; align-items: center;' });
						div.appendChild(E('img', { 'src': L.resource('view/pse/icons/' + icon + '.svg'), 'alt': _(port.alt) }));
						div.appendChild(E('span', { style: 'margin-top: 4px; color: #333;' }, _(port.alt)));
						if (obj && obj.isNoPower == 0) 
							div.appendChild(E('span', { style: 'margin-top: 4px; color: #333;' }, obj.power + 'W'));
						else
							div.appendChild(E('span', { style: 'margin-top: 4px; color: #333;' }, '-'));
						container.appendChild(div);
					});

					let icon = 'ethernet';
					let obj = status.wanList.find(item => item.name === "WAN 1");
					if (obj && obj.isNoPower == 0) icon += '-poein';
					if (devices.wan.link.speed == 100) icon += '-100';
					if (devices.wan.link.speed == 1000) icon += '-1000';
					let divWan = E('div', { style: 'flex: 1; display: flex; flex-direction: column; align-items: center;' });
					divWan.appendChild(E('img', { 'src': L.resource('view/pse/icons/' + icon + '.svg'), 'alt': _('WAN') }));
					divWan.appendChild(E('span', { style: 'margin-top: 4px; color: #333;' }, _('WAN')));

					container.appendChild(divWan);

					node.appendChild(container);
					node.appendChild(E('br'));
					return node;
				}, this));
		}, s, this);


		s = m.section(form.NamedSection, 'power', 'power', _('Power Capacity'));
		s.render = L.bind(function(view /*, ... */) {
			const percent = status.power_capacity.now * 100 / status.power_capacity.max;
			return form.NamedSection.prototype.render.apply(this, this.varargs(arguments, 1))
				.then(L.bind(function(node) {
					node.appendChild(E('br'));
					node.appendChild(E('div', { 'style': 'text-align: center' }, [ _('Power Consumption: %0.1f%% (%dW of %dW)').format(percent, status.power_capacity.now, status.power_capacity.max) ]));
					node.appendChild(E('br'));
					node.appendChild(E('div', { 'style': 'width: 100%;background: rgba(25, 118, 210, 0.25);border: 2px solid #1976d2;border-radius: 12px;height: 28px;box-sizing: border-box;position: relative;overflow: hidden;' }, [
						E('div', { 'style': 'height: 100%;background: #1976d2;border-radius: 12px 0 0 12px;transition: width 0.4s;width:' + percent + '%;' }, [''])
					]));
					node.appendChild(E('br'));
					return node;
				}, this));
		}, s, this);


		s = m.section(form.GridSection, 'port');
		s.anonymous = true;
		s.rowcolors = true;

		s.handleRecovery = function(section_id, ev) {
			const port = parseInt(uci.get('pse', section_id, 'port_id'));
			return L.resolveDefault(callPseRecovery(port), {}).then(function() {
				L.resolveDefault(callPseStatus(), {}).then(function(res) {
					status = res;
					L.resolveDefault(callNetworkDevices(), {}).then(function(res1) {
						devices = res1;
						return m.render();
					});
				});
			});
		};

		s.handleToggle = function(section_id, ev) {
			const port = parseInt(uci.get('pse', section_id, 'port_id'));
			return L.resolveDefault(callPseToggle(port), {}).then(function() {
				L.resolveDefault(callPseStatus(), {}).then(function(res) {
					status = res;
					L.resolveDefault(callNetworkDevices(), {}).then(function(res1) {
						devices = res1;
						return m.render();
					});
				});
			});
		};

		s.renderRowActions = function(section_id) {
			const tdEl = this.super('renderRowActions', [ section_id, _('Edit') ]),
				recovery_opt = {
					'class': 'cbi-button cbi-button-neutral',
					'click': ui.createHandlerFn(this, 'handleRecovery', section_id),
					'title': _('Recovery'),
				},
				toggle_opt = {
					'class': 'cbi-button cbi-button-neutral',
					'click': ui.createHandlerFn(this, 'handleToggle', section_id),
					'title': _('Toggle'),
				};
			dom.content(tdEl.lastChild, [
				E('button', recovery_opt, _('Recovery')),
				E('button', toggle_opt, _('Toggle'))
			]);
			return tdEl;
		};


		o = s.option(form.Value, 'port_id', _('Port'));
		o.textvalue = function (section_id) {
			let portname = '';
			switch (uci.get('pse', section_id, 'port_id')) {
				case '0':
					portname = _('LAN 5');
					break;
				case '1':
					portname = _('LAN 4');
					break;
				case '2':
					portname = _('LAN 3');
					break;
				case '3':
					portname = _('LAN 2');
					break;
			}
			return portname;
		};
		o.modalonly = false;

		o = s.option(form.Flag, 'enable', _('Enabled'));
		o.editable = true;
		o.rmempty = false;

		o = s.option(form.DummyValue, '_power', _('Power Consumption'));
		o.rawhtml = true;
		o.write = function() {};
		o.remove = function() {};
		o.modalonly = false;
		o.textvalue = function (section_id) {
			let ret = '';
			const port = 'LAN ' + (parseInt(uci.get('pse', section_id, 'port_id')) + 1)
			const obj = status.lanList.find(item => item.name === port);
			if (obj) {
				if (obj.isNoPower == 1)
					ret = '-';
				else
					ret = obj.power + 'W';
			}
			return E('span', ret);
		};

		poll.add(() => {
			L.resolveDefault(callPseStatus(), {}).then(function(res) {
				status = res;
				L.resolveDefault(callNetworkDevices(), {}).then(function(res1) {
					devices = res1;
					return m.render();
				});
			});
		}, 15);

		return m.render();
	}
});
