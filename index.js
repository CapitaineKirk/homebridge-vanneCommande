var Service;
var Characteristic;
var net = require('net');

var tableauValve = [];
var tableauSwitch = [];

const date = require('date-and-time');
const TCP_PORT = 6722;
const TCP_CMD_STATUS ="00";
const TCP_TIMEOUT = 500;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-vanneCommande', 'VanneCommande', ValveCmdAccessory);
  homebridge.registerAccessory('homebridge-switchCommande', 'SwitchCommande', SwitchCmdAccessory);
};

function SwitchCmdAccessory(log, config) {
  this.log = log;
  this.name = config.name;
  this.indice = config.indice;
  this.etatSwitch = false; //Etat initial

  tableauSwitch[this.indice] = this;
  
  this.log('Fin SwicthmdAccessory');
}

SwitchCmdAccessory.prototype.setOn = function(estOn, callback, context) {
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }

  var accessory = this;
  var accessoryValve = tableauValve[this.indice];

  if(estOn) {
    accessory.etatSwitch = true;
    if(accessoryValve.etatValveDemande == Characteristic.Active.INACTIVE) {
      accessoryValve.modeManuel = false;
      accessory.log("mode Manuel = false");
      accessoryValve.valveService.getCharacteristic(Characteristic.Active).setValue(Characteristic.Active.ACTIVE);
    }
    accessory.log('Appel de setOn : True');
  } else {
    accessory.etatSwitch = false;
    if(accessoryValve.etatValveDemande == Characteristic.Active.ACTIVE) {
      accessoryValve.valveService.getCharacteristic(Characteristic.Active).setValue(Characteristic.Active.INACTIVE);
    }
    accessory.log('Appel de setOn : False');
  }

  callback();
  return true;
};

SwitchCmdAccessory.prototype.getOn = function(callback) {
  var accessory = this;

  accessory.log('Appel de getOn');
  callback(null, accessory.etatSwitch);
}

SwitchCmdAccessory.prototype.getServices = function() {
  this.log('Debut Getservices');
  this.informationService = new Service.AccessoryInformation();
  this.switchService = new Service.Switch(this.name);

  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Capitaine Kirk Factory')
  .setCharacteristic(Characteristic.Model, 'Switch Command')
  .setCharacteristic(Characteristic.SerialNumber, '1.0');

  this.switchService.getCharacteristic(Characteristic.On)
  .on('set', this.setOn.bind(this))
  .on('get', this.getOn.bind(this))
  .updateValue(this.etatSwitch);


  return [this.informationService, this.switchService];
}

function ValveCmdAccessory(log, config) {
  this.log = log;
  this.name = config.name;
  this.adresseIp = config.adresseIp;
  this.relais = config.relais;
  this.indice = config.indice;
  this.dureeDemandee = config.dureeDemandee || 0;
  this.intervalLecture = config.intervalLecture || 1;
  this.etatValveDemande = Characteristic.Active.INACTIVE; //Etat initial
  this.etatValveActuel = Characteristic.InUse.NOT_IN_USE; //Etat initial
  this.etatValveEnDefaut = Characteristic.StatusFault.NO_FAULT; //Etat initial
  this.capteurValveOuvert = false;
  this.capteurValveEnDefaut = false;
  this.modeManuel = false;

  this.debug = config.debug || 0;

  tableauValve[this.indice] = this;
  
  this.log('Fin ValveCmdAccessory');

 //A short summary for Active / InUse - Logic:
 //Active=0, InUse=0 -> Off
 //Active=1, InUse=0 -> Waiting [Starting, Activated but no water flowing (yet)]
 //Active=1, InUse=1 -> Running
 //Active=0, InUse=1 -> Stopping
}

ValveCmdAccessory.prototype.setActive = function(estActive, callback, context) {
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }

  var accessory = this;
  var accessorySwitch = tableauSwitch[this.indice];


  if(estActive == Characteristic.Active.ACTIVE) {
    accessory.etatValveDemande = Characteristic.Active.ACTIVE;
    if(!accessorySwitch.etatSwitch) {
      accessory.modeManuel = true;
      accessory.log("mode Manuel = true");
      //accessory.switchService.getCharacteristic(Characteristic.On).setValue(true);
      accessorySwitch.switchService.getCharacteristic(Characteristic.On).setValue(true);
    }
    accessory.log('Appel de setActive : etatValveDemande = ACTIVE');
  }
  if(estActive == Characteristic.Active.INACTIVE) {
    accessory.etatValveDemande = Characteristic.Active.INACTIVE;
    if(accessorySwitch.etatSwitch) {
      //accessory.switchService.getCharacteristic(Characteristic.On).setValue(false);
      accessorySwitch.switchService.getCharacteristic(Characteristic.On).setValue(false);
    }
    accessory.log('Appel de setActive : etatValveDemande = INACTIVE');
  }

  callback();
  return true;
};

ValveCmdAccessory.prototype.getActive = function(callback) {
  var accessory = this;

  accessory.log('Appel de getActive');
  callback(null, accessory.etatValveDemande);
}

ValveCmdAccessory.prototype.getInUse = function(callback) {
  var accessory = this;

  accessory.log('Appel de getInUse');
  callback(null, accessory.etatValveActuel);
}

ValveCmdAccessory.prototype.setSetDuration = function(duration, callback, context) {
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }

  var accessory = this;

  accessory.dureeDemandee = duration;
  accessory.log('Appel de setSetDuration : Duree = ',duration);

  callback();
  return true;
};

ValveCmdAccessory.prototype.getSetDuration = function(callback) {
  var accessory = this;

  accessory.log('Appel de getSetDuration');
  callback(null, accessory.dureeDemandee);
}

ValveCmdAccessory.prototype.setRemainingDuration = function(duration, callback, context) {
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }

  var accessory = this;

  accessory.dureeRestante = duration;
  accessory.log('Appel de setRemainingDuration : Duree = ',duration);

  callback();
  return true;
};

ValveCmdAccessory.prototype.getRemainingDuration = function(callback) {
  var accessory = this;

  accessory.log('Appel de getRemainingDuration');
  callback(null, accessory.dureeRestante);
}

ValveCmdAccessory.prototype.getStatusFault = function(callback) {
  var accessory = this;

  accessory.log('Appel de getStatusFault');
  callback(null, accessory.etatEnDefaut);
}

ValveCmdAccessory.prototype.handleEventConnect = function() {
  this.log('Evenement connexion');
  if (this.stateTimer) {
    clearTimeout(this.stateTimer);
    this.stateTimer = null;
  }
  this.stateTimer = setImmediate(this.QueryState.bind(this));
}

ValveCmdAccessory.prototype.handleEventTimeout = function() {
  this.log('Evenement timeout');
  this.socket.connect(TCP_PORT, this.adresseIp);
}

ValveCmdAccessory.prototype.handleEventError = function(error) {
  this.log('Evenement error (' + error.code + ')');
}

ValveCmdAccessory.prototype.handleEventClose = function() {
  this.log('Evenement close');
  this.socket.connect(TCP_PORT, this.adresseIp);
}

ValveCmdAccessory.prototype.handleEventData = function(data) {
  if(this.debug) {
    this.log('Evenement data');
  }

	try {
		this.lectureCapteur = data.toString('utf-8').substring(this.relais-1,this.relais);
	} catch(exception) {
		this.log("Erreur lecture de l'etat :" + exception.sdout);
		this.lectureCapteur = '';
	}
  if(this.debug) {
    this.log('Donnees : ' + this.lectureCapteur);
  }
  if (this.stateTimer) {
    clearTimeout(this.stateTimer);
    this.stateTimer = null;
  }
  this.stateTimer = setImmediate(this.monitorState.bind(this));
}

ValveCmdAccessory.prototype.handleEventEnd = function() {
  this.log('Evenement end');
}

ValveCmdAccessory.prototype.QueryState = function() {
  if(this.debug) {
    this.log('Interrogation du capteur');
  }
  if(!this.socket.write(TCP_CMD_STATUS)){
    if(this.debug) {
      this.log('Interrogation ratee');
    }
    this.lectureCapteur = '';
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = null;
    }
    this.stateTimer = setImmediate(this.monitorState.bind(this));
  } else {
    if(this.debug) {
      this.log('Interrogation reussie');
    }
  }
}

ValveCmdAccessory.prototype.monitorState = function() {
  var accessory = this;
  var accessorySwitch = tableauSwitch[this.indice];

  var lectureCapteur = '';
  var valveChange = false;

  if(accessory.debug) {
    if(accessorySwitch.etatSwitch) {
      accessory.log("etatSwitch = ON");
    } else {
      accessory.log("etatSwitch = OFF");
    }

    if(accessory.etatValveDemande == Characteristic.Active.ACTIVE) {
      accessory.log("etatValveActive = ACTIVE");
    } else {
      accessory.log("etatValveActive = INACTIVE");
    }

    if(accessory.modeManuel) {
      accessory.log('Mode manuel');
    } else {
      accessory.log('Mode automatique');
    }
  }

	switch(accessory.lectureCapteur) {
		case '1' :
			accessory.capteurValveOuvert = true;
			accessory.capteurValveEnDefaut = false;
			if(accessory.debug) {
				accessory.log('Etat du capteur de ' + accessory.name + ' est (ON) : ' + lectureCapteur + '(' + accessory.capteurValveOuvert + ')');
			}
			break;
		case '0' :
			accessory.capteurValveOuvert = false;
			accessory.capteurValveEnDefaut = false;
			if(accessory.debug) {
				accessory.log('Etat du capteur de ' + accessory.name + ' est (OFF) : ' + lectureCapteur + '(' + accessory.capteurValveOuvert + ')');
			}
			break;
		default :
			accessory.capteurValveEnDefaut = true;
			if(accessory.debug) {
				accessory.log('Etat du capteur de ' + accessory.name + ' est (KO) : ' + lectureCapteur + '(' + accessory.capteurValveEnDefaut + ')');
			}
			break;
	}

  if ((accessory.capteurValveEnDefaut && (accessory.etatValveEnDefaut == Characteristic.StatusFault.NO_FAULT)) ||
      (!accessory.capteurValveEnDefaut && (accessory.etatValveEnDefaut == Characteristic.StatusFault.GENERAL_FAULT))) {
    if(accessory.capteurValveEnDefaut) {
      accessory.log("Etat defaut de " + accessory.name + " est : GENERAL_FAULT");
      accessory.etatValveEnDefaut = Characteristic.StatusFault.GENERAL_FAULT;
    } else {
      accessory.log("Etat defaut de " + accessory.name + " est : NO_FAULT");
      accessory.etatValveEnDefaut = Characteristic.StatusFault.NO_FAULT;
    }
    accessory.valveService.getCharacteristic(Characteristic.StatusFault).updateValue(this.etatValveEnDefaut);
  }

  if(!accessory.capteurValveEnDefaut) {
    
    if(accessory.capteurValveOuvert) {
      if(accessory.etatValveDemande == Characteristic.Active.INACTIVE) {
        accessory.log("Etat demande de " + accessory.name + " est : INACTIVE");
        commande = '2' + this.relais;
        valveChange = true;
      } else {
        if(accessory.etatValveActuel != Characteristic.InUse.IN_USE) {
          accessory.etatValveActuel = Characteristic.InUse.IN_USE;
          accessory.valveService.getCharacteristic(Characteristic.InUse).updateValue(accessory.etatValveActuel);
					accessory.dateDebut = new Date();
					// si mode manuel et duree demandee != 0
					if((accessory.modeManuel) && (accessory.dureeDemandee != 0)) {
						accessory.valveService.getCharacteristic(Characteristic.RemainingDuration).updateValue(accessory.dureeDemandee);
						accessory.log("Mode manuel, durée demandée = " + accessory.dureeDemandee + " s");
					}
        }
      }
    } else {
      if(accessory.etatValveDemande == Characteristic.Active.ACTIVE) {
        accessory.log("Etat demande de " + accessory.name + " est : ACTIVE");
        commande = '1' + this.relais;
        valveChange = true;
      } else {
        if(accessory.etatValveActuel != Characteristic.InUse.NOT_IN_USE) {
          accessory.etatValveActuel = Characteristic.InUse.NOT_IN_USE;
          accessory.valveService.getCharacteristic(Characteristic.InUse).updateValue(accessory.etatValveActuel);
					// ne pas oublier de remettre a zero le compteur de temps restant
					accessory.valveService.getCharacteristic(Characteristic.RemainingDuration).updateValue(0);
        }
      }
    }
  }

  if((accessory.etatValveActuel == Characteristic.InUse.IN_USE) && (accessory.modeManuel) && (accessory.dureeDemandee != 0)) {
    var dateActuelle = new Date();
    var deltaSecondes = date.subtract(dateActuelle, accessory.dateDebut).toSeconds();

    accessory.dureeRestante = accessory.dureeDemandee - deltaSecondes;;

    if(accessory.debug) {
      accessory.log("Temps écoulé = "+ deltaSecondes + " s, temps restant = " + accessory.dureeRestante + " s");
    }

    if(accessory.dureeRestante < 0) {
      accessory.log("Fin du délai d'arrosage");
      accessory.log("Etat demande de " + accessory.name + " est : INACTIVE");
      accessory.valveService.getCharacteristic(Characteristic.Active).setValue(Characteristic.Active.INACTIVE);
    }
  }

  if(valveChange) {
    try {
      accessory.socket.write(commande);
    } catch(exception) {
	    accessory.log("Erreur d\'exécution de la commande : " + exception.sdout);
    }
  }

  // Clear any existing timer
  if (accessory.stateTimer) {
    clearTimeout(accessory.stateTimer);
    accessory.stateTimer = null;
  }
  accessory.stateTimer = setTimeout(this.QueryState.bind(this),(accessory.intervalLecture) * 1000);
}

ValveCmdAccessory.prototype.getServices = function() {
  this.log('Debut Getservices');
  this.informationService = new Service.AccessoryInformation();
  this.valveService = new Service.Valve(this.name);

  this.log('Debut informationService');
  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Capitaine Kirk Factory')
  .setCharacteristic(Characteristic.Model, 'Valve Command')
  .setCharacteristic(Characteristic.SerialNumber, '1.0');

  // choisi l'icone d'arrosage
  this.log('Debut ValveType');
  this.valveService.getCharacteristic(Characteristic.ValveType).updateValue(Characteristic.ValveType.IRRIGATION);

  this.log('Debut getCharacteristicActive');
  this.valveService.getCharacteristic(Characteristic.Active)
  .on('set', this.setActive.bind(this))
  .on('get', this.getActive.bind(this))
  .updateValue(this.etatValveDemande);

  this.valveService.getCharacteristic(Characteristic.InUse)
  .on('get', this.getInUse.bind(this))
  .updateValue(this.etatValveActuel);

  this.valveService.getCharacteristic(Characteristic.SetDuration)
  .on('set', this.setSetDuration.bind(this))
  .on('get', this.getSetDuration.bind(this))
  .updateValue(this.dureeDemandee);

  this.valveService.getCharacteristic(Characteristic.RemainingDuration)
  .on('set', this.setRemainingDuration.bind(this))
  .on('get', this.getRemainingDuration.bind(this))
  .updateValue(this.dureeRestante);

  this.valveService.getCharacteristic(Characteristic.StatusFault)
  .on('get', this.getStatusFault.bind(this))
  .updateValue(this.etatValveEnDefaut);

  this.socket = new net.Socket();
  this.socket.setTimeout(TCP_TIMEOUT);
  this.socket.on('connect',this.handleEventConnect.bind(this))
  this.socket.on('timeout',this.handleEventTimeout.bind(this))
  this.socket.on('error',this.handleEventError.bind(this))
  this.socket.on('close',this.handleEventClose.bind(this))
  this.socket.on('data',this.handleEventData.bind(this))
  this.socket.on('end',this.handleEventEnd.bind(this))

  this.log('Connexion a ' + this.adresseIp);
  this.socket.connect(TCP_PORT, this.adresseIp);

  this.stateTimer = setTimeout(this.QueryState.bind(this),this.intervalLecture * 1000);

  return [this.informationService, this.valveService];
}
