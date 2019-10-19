var Service;
var Characteristic;
var execSync = require('child_process').execSync;

var tableauValve = [];
var tableauSwitch = [];

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
  this.indice = config.indice;
  this.envoyerCommandeOuverture = config.envoyerCommandeOuverture;
  this.envoyerCommandeFermeture = config.envoyerCommandeFermeture;
  this.lireEtat = config.lireEtat;
  this.intervalLecture = config.intervalLecture || 1;
  this.etatValveDemande = Characteristic.Active.INACTIVE; //Etat initial
  this.etatValveActuel = Characteristic.InUse.NOT_IN_USE; //Etat initial
  this.etatValveEnDefaut = Characteristic.StatusFault.NO_FAULT; //Etat initial
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



ValveCmdAccessory.prototype.monitorState = function() {
  var accessory = this;
  var accessorySwitch = tableauSwitch[this.indice];

  var capteurValveOuvert = false;
  var capteurValveEnDefaut = false;
  var lectureCapteur = '';
  var valveChange = false;
  var lectureCommande = '';
  var commande;
  var etatActuelFutur;
  var delaiSupplementaire = 0;

  if(accessory.debug) {
    if(accessorySwitch.etatSwitch) {
      accessory.log("etatSwtch = ON");
    } else {
      accessory.log("etatSwtch = OFF");
    }

    if(accessory.etatValveDemande == Characteristic.Active.ACTIVE) {
      accessory.log("etatValveActive = ACTIVE");
    } else {
      accessory.log("etatValveActive = INACTIVE");
    }
  }

  if(accessory.debug) {
    accessory.log('Commnande executée : ' + accessory.lireEtat);
  }
  try {
    buffer = execSync(accessory.lireEtat);
    lectureCapteur = buffer.toString('utf-8').substring(0,2);
  } catch(exception) {
    accessory.log("Erreur lecture de l'etat :" + exception.sdout);
    LectureCapteur = '';
  }
  switch(lectureCapteur) {
    case 'ON' : 
      capteurValveOuvert = true;
      capteurValveEnDefaut = false;
      if(accessory.debug) {
        accessory.log('Etat du capteur de ' + accessory.name + ' est (ON) : ' + lectureCapteur + '(' + capteurValveOuvert + ')');
      }
      break;
    case 'OF' :
      capteurValveOuvert = false;
      capteurValveEnDefaut = false;
      if(accessory.debug) {
        accessory.log('Etat du capteur de ' + accessory.name + ' est (OFF) : ' + lectureCapteur + '(' + capteurValveOuvert + ')');
      }
      break;
    default :
      capteurValveEnDefaut = true;
      if(accessory.debug) {
        accessory.log('Etat du capteur de ' + accessory.name + ' est (KO) : ' + lectureCapteur + '(' + capteurValveEnDefaut + ')');
      }
      break;
  }

  if ((capteurValveEnDefaut && (accessory.etatValveEnDefaut == Characteristic.StatusFault.NO_FAULT)) ||
      (!capteurValveEnDefaut && (accessory.etatValveEnDefaut == Characteristic.StatusFault.GENERAL_FAULT))) {
    if(capteurValveEnDefaut) {
      accessory.log("Etat defaut de " + accessory.name + " est : GENRAL_FAULT");
      accessory.etatValveEnDefaut = Characteristic.StatusFault.GENERAL_FAULT;
    } else {
      accessory.log("Etat defaut de " + accessory.name + " est : NO_FAULT");
      accessory.etatValveEnDefaut = Characteristic.StatusFault.NO_FAULT;
    }
    accessory.valveService.getCharacteristic(Characteristic.StatusFault).updateValue(this.etatValveEnDefaut);
  }

  if(!capteurValveEnDefaut) {
    if(capteurValveOuvert && (accessory.etatValveDemande == Characteristic.Active.INACTIVE)) {
        accessory.log("Etat demande de " + accessory.name + " est : INACTIVE");
        commande = accessory.envoyerCommandeFermeture;
        etatActuelFutur = Characteristic.InUse.NOT_IN_USE;
        valveChange = true;
    }
    if(!capteurValveOuvert && (accessory.etatValveDemande == Characteristic.Active.ACTIVE)) {
        accessory.log("Etat demande de " + accessory.name + " est : ACTIVE");
        commande = accessory.envoyerCommandeOuverture;
        etatActuelFutur = Characteristic.InUse.IN_USE;
        valveChange = true;
    }
  }

  if(valveChange) {
    try {
      buffer = execSync(commande);
      lectureCommande = buffer.toString('utf-8').substring(0,2);
    } catch(exception) {
	    accessory.log("Erreur d\'exécution de la commande : " + exception.sdout);
      LectureCommande = '';
    }
    switch(lectureCommande) {
      case 'OK' : 
        accessory.etatValveActuel = etatActuelFutur;
        accessory.valveService.getCharacteristic(Characteristic.InUse).updateValue(accessory.etatValveActuel);
        delaiSupplementaire = 1;
        accessory.log('Commande pour ' + accessory.name + ' terminee avec le statut (OK)');
        break;
      case 'KO' :
        accessory.log('Commande pour ' + accessory.name + ' terminee avec le statut (KO)');
      break;
      default :
        accessory.log('Commande pour ' + accessory.name + ' terminee avec le statut (inconnu) : ' + lectureCommande);
       break;
    }
  }

  // Clear any existing timer
  if (accessory.stateTimer) {
    clearTimeout(accessory.stateTimer);
    accessory.stateTimer = null;
  }
  accessory.stateTimer = setTimeout(this.monitorState.bind(this),(accessory.intervalLecture + delaiSupplementaire) * 1000);
};

ValveCmdAccessory.prototype.getServices = function() {
  this.log('Debut Getservices');
  this.informationService = new Service.AccessoryInformation();
  this.valveService = new Service.Valve(this.name);
  //this.switchService = new Service.Switch(this.name);
  //this.StatelessProgrammableSwitch = new Service.StatelessProgrammableSwitch(this.name);

  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Capitaine Kirk Factory')
  .setCharacteristic(Characteristic.Model, 'Valve Command')
  .setCharacteristic(Characteristic.SerialNumber, '1.0');

  // choisi l'icone d'arrosage
  this.valveService.getCharacteristic(Characteristic.ValveType).updateValue(Characteristic.ValveType.IRRIGATION);

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

  this.stateTimer = setTimeout(this.monitorState.bind(this),this.intervalLecture * 1000);

//  return [this.informationService, this.valveService, this.switchService, this.StatelessProgrammableSwitch];
  return [this.informationService, this.valveService];
};
