window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame       || 
            window.webkitRequestAnimationFrame || 
            window.mozRequestAnimationFrame    || 
            window.oRequestAnimationFrame      || 
            window.msRequestAnimationFrame     || 
            function( callback ){
              window.setTimeout(callback, 1000 / 60);
            };
})();

elation.extend("games.schess", {
  games: [],
  init: function(container, options) {
    this.games.push(new this.game(container, options));
  },

                               
  game: function(container, options) {
    this.container = container;
    this.options = options || {};
    this.boards = [];
    this.pieces = {
      white: {},
      black: {}
    };
    this.legalmoves = {
      'rook': [ [-1,  0, 8], [ 0, -1, 8], [ 0,  1, 8], [ 1,  0, 8], ],
      'bishop': [ [-1, -1, 8], [-1,  1, 8], [ 1, -1, 8], [ 1,  1, 8] ],
      'knight': [ [-2,  1, 1], [-2, -1, 1], [-1,  2, 1], [-1, -2, 1], [ 1,  2, 1], [ 1, -2, 1], [ 2,  1, 1], [ 2, -1, 1] ],
      'queen': [ [-1, -1, 8], [-1,  0, 8], [-1,  1, 8], [ 0, -1, 8], [ 0,  1, 8], [ 1, -1, 8], [ 1,  0, 8], [ 1,  1, 8] ],
      'king': [ [-1, -1, 1], [-1,  0, 1], [-1,  1, 1], [ 0, -1, 1], [ 0,  1, 1], [ 1, -1, 1], [ 1,  0, 1], [ 1,  1, 1] ]
    };
    this.initialstate = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
    this.init = function() {
      if (typeof this.container == "string") {
        this.container = document.getElementById(this.container);
      }
      this.boards['main'] = new elation.games.common.board(this.container, {game: this, size: [8, 8], className: 'schess_board_main', innerboard: true});
      for (var y = 0; y < 8; y++) {
        for (var x = 0; x < 8; x++) {
          this.boards['main'].slots[y][x].setType((x % 2 - y % 2)? 'black' : 'white');
          this.boards['main'].slots[y][x].element.style.backgroundPosition = (x * 32) + "px " + (y * 32) + "px";
        }
      }
      this.cpudelay = 1000;
      this.players = {'white': 'local', 'black': 'cpu'};

      this.fen = this.options.fen || this.initialstate;

      this.loadFEN(this.fen);

      this.viewanglemin = 15;
      this.viewanglesnap = 5;
      this.viewangle = [0, 60];
      this.setViewAngle(this.viewangle);
      elation.html.addclass(this.container, "schess_3d");
      elation.events.add(this.container, 'mousedown,touchstart', this);

      elation.onloads.add(function() {
        setTimeout(function() { // iPhone scroll
          window.scrollTo(0,1);
        }, 500);
      });

      this.play();
    }
    this.loadFEN = function(fen) {
      var mapping = {
        'r': ['rook', 'black'],
        'n': ['knight', 'black'],
        'b': ['bishop', 'black'],
        'q': ['queen', 'black'],
        'k': ['king', 'black'],
        'p': ['pawn', 'black'],
        'R': ['rook', 'white'],
        'N': ['knight', 'white'],
        'B': ['bishop', 'white'],
        'Q': ['queen', 'white'],
        'K': ['king', 'white'],
        'P': ['pawn', 'white'],
      };
      var counts = {'white': {}, 'black': {}};
      var fenparts = fen.split(' ');

      var row = 0, col = 0;
      for (var i = 0; i < fenparts[0].length; i++) {
        var fchar = fenparts[0][i];
        if (mapping[fchar]) {
          var m = mapping[fchar];
          var player = m[1];
          var count = counts[player][m[0]] || 1;
          counts[player][m[0]] = count + 1;
          var name = m[0] + (count > 1 ? count : '');
          var piece = this.createPiece(player, m[0], name);

          this.pieces[player][name] = piece;
          var slot = this.boards['main'].getSlot(row, col); 
          this.pieces[player][name].setSlot(slot, false);
          col++;
        } else if (fchar == '/') {
          col = 0;
          row++;
        } else if (elation.utils.isnumeric(fchar)) {
          col += parseInt(fchar);
        }
      }

      this.activeplayer = (fenparts[1] == 'b' ? 'black' : 'white');

      // castle status
      if (fenparts[2]) {
        if (fenparts[2].indexOf('Q') == -1) this.pieces['white']['rook'].moved = true;
        if (fenparts[2].indexOf('K') == -1) this.pieces['white']['rook2'].moved = true;
        if (fenparts[2].indexOf('q') == -1) this.pieces['black']['rook'].moved = true;
        if (fenparts[2].indexOf('k') == -1) this.pieces['black']['rook2'].moved = true;
      }

      if (typeof p4_new_game == 'function') { // p4wn game engine is loaded, start a new game
        this.engine = p4_fen2state(this.fen);
      }
    }
    this.createPiece = function(player, type, name) {
      return new elation.games.schess.piece(elation.html.create(), {type: type, name: name, player: player, game: this});
    }
    this.setViewAngle = function(angle, cleartransition) {
      //this.viewangle = angle;
      var boardel = this.boards['main'].element;
      var snapangle = [angle[0], angle[1]];

      if (angle[0] < this.viewanglesnap || angle[0] > 360 - this.viewanglesnap) {
        snapangle[0] = 0;
      }
      if (angle[0] > 180 - this.viewanglesnap && angle[0] < 180 + this.viewanglesnap) {
        snapangle[0] = 180;
      }
      elation.html.transform(this.boards['main'].element, 'rotateX(' + snapangle[1] + 'deg) rotateZ(' + snapangle[0] + 'deg) ');

      var use2dpieces = (angle[1] < this.viewanglemin * 2);
      for (var player in this.pieces) {
        for (var piece in this.pieces[player]) {
          this.pieces[player][piece].setViewAngle(snapangle, use2dpieces, cleartransition);
        }
      }
    }
    this.handleEvent = function(ev) {
      if (typeof this[ev.type] == 'function') {
        return this[ev.type](ev);
      }
    }
    this.mousedown = function(ev) {
      if (typeof ev.button == 'undefined' || ev.button == 0) {
        this.dragging = true;
        this.dragpos = [ev.screenX, ev.screenY];
        elation.events.add(window, 'mousemove,mouseup,touchmove,touchend', this);
        this.render();
      }
    }
    this.mousemove = function(ev) {
      var diff = [this.dragpos[0] - ev.screenX, this.dragpos[1] - ev.screenY];
      this.viewangle[0] += diff[0];
      this.viewangle[1] += diff[1];
      this.viewangle[0] %= 360;
      if (this.viewangle[0] < 0) {
        this.viewangle[0] += 360;
      }

      if (this.viewangle[1] > 90 - this.viewanglemin) {
        this.viewangle[1] = 90 - this.viewanglemin;
      } else if (this.viewangle[1] < 0) {
        this.viewangle[1] = 0;
      }
      this.dragpos = [ev.screenX, ev.screenY];
    }
    this.mouseup = function(ev) {
      this.dragging = false;
      elation.events.remove(window, 'mousemove,mouseup,touchmove,touchend', this);
    }
    this.touchstart = function(ev) {
      if (ev.touches.length == 1) {
        window.scrollTo(0,1);
        ev.touches[0].preventDefault = ev.preventDefault;
        this.mousedown(ev.touches[0]);
        ev.preventDefault();
      }
    }
    this.touchmove = function(ev) {
      this.mousemove(ev.touches[0]);
    }
    this.touchend = function(ev) {
      if (ev.touches.length == 0) {
        this.mouseup(ev);
      }
    }
    this.render = function() {
      this.setViewAngle(this.viewangle);
      if (this.dragging) {
        (function(self) {
          requestAnimFrame(function() { self.render(); });
        })(this);
      }
    }
    this.move = function(start, end) {
      var movestatus = this.engine.move(start, end);
      var proceed = false;
      if (movestatus.ok) {
        var otherplayer = (this.activeplayer == 'black' ? 'white' : 'black');
        if (movestatus.flags & P4_MOVE_FLAG_CHECK) {
          this.pieces[otherplayer]['king'].slot.addClass('state_check');
          if (movestatus.flags & P4_MOVE_FLAG_MATE) {
            this.showMessage('checkmate - ' + this.activeplayer + ' wins');
            this.pieces[otherplayer]['king'].slot.addClass('state_mate');
            this.checkmate = true;
            proceed = true;
          } else {
            this.showMessage('check!');
            proceed = true;
          }
        } else {
          proceed = true;
        }
      } else {
        console.log('ERROR: MOVE FAILED: ' + this.activeplayer + '(' + this.players[this.activeplayer] + '): ' + start + '-' + end, movestatus);
      }
      if (proceed) {
        this.passControl();
      }
      return proceed;
    }
    this.passControl = function() {
      if (this.checkmate) {
        console.log('game is over!');
        (function(player) {
          setTimeout(function() {
            alert('Checkmate!  ' + player + ' wins!');
          }, 500);
        })(this.activeplayer);
      } else {
        var newplayer = (this.activeplayer == 'white' ? 'black' : 'white');
        //console.log('passing control to ' + newplayer);
        this.activeplayer = newplayer;
        this.play();
      }
    }
    this.play = function() {
      var player = this.activeplayer;
      if (this.players[player] == 'cpu') {
        (function(self) {
          setTimeout(function() {
            self.playCPU();
          }, self.cpudelay);
        })(this);
      }
    }
    this.playCPU = function() {
      var newmove = this.engine.findmove(3);
      var newstart = p4_stringify_point(newmove[0]);
      var newend = p4_stringify_point(newmove[1]);
      var startslot = this.rankFileToSlot(newstart);
      var endslot = this.rankFileToSlot(newend);
      var piece = startslot.pieces[0];
      if (piece) {
        piece.pickup();
        piece.drop(endslot);
      } else {
        console.log('ERROR: MOVE FAILED: ' + this.activeplayer + '(' + this.players[player] + '): ' + newstart + '-' + newend + ': no piece in slot', startslot);
      }
    }
    this.rankFileToSlot = function(rankfile) {
      var col = rankfile.charCodeAt(0) - 97;
      var row = 8 - rankfile[1];
      return this.boards['main'].getSlot(row, col);
    }
    this.slotToRankFile = function(slot) {
      return String.fromCharCode(97 + slot.col) + (8 - slot.row);
    }
    this.showMessage = function(msg, type) {
      //console.log('MESSAGE:', msg);
    }

    this.init();
  },

  player: function(name, type) {
    this.init = function() {
      this.name = name;
      this.type = type || 'local';
    }
  },
  piece: function(container, options) {
    this.init = function() {
      this.container = container;
      this.name = options.name || options.type;
      this.game = options.game;
      this.moved = 0;
      elation.html.addclass(this.container, "game_piece");
      if (options.type) {
        this.setType(options.type);
      }
      if (options.player) {
        this.setPlayer(options.player);
      }
      elation.events.add(this.container, "mousedown,touchstart", this);
    }
    this.setType = function(type) {
      if (this.type && this.type != type) {
        elation.html.removeclass(this.container, "schess_piece_" + this.type);
      }
      this.type = type;
      elation.html.addclass(this.container, "schess_piece_" + this.type);
    }
    this.setPlayer = function(player) {
      if (this.player && this.player != player) {
         elation.html.removeclass(this.container, "schess_player_" + this.player);
      }
      this.player = player;
       elation.html.addclass(this.container, "schess_player_" + this.player);
    }
    this.setViewAngle = function(angle, use2d, cleartransition) {
      var transform = '', origin = false, transition = '';
      if (!use2d) {
        if (cleartransition || !this.use2d) {
          transition = 'all 0ms linear';
        } else {
          transition = 'all 100ms linear';
        }
        origin = '50% 100%';
        transform = 'translate3d(0px, -50%, 5px) rotateX(-90deg) rotateY(' + angle[0] + 'deg) ';
      } else {
        transition = 'all ' + (cleartransition ? 0 : 100) + 'ms linear';
        var anglez = (Math.abs(angle[0]) < 90 || Math.abs(angle[0]) > 270 ? 0 : 180);
        origin = '50% 50%';
        transform = 'translate3d(0, 0, 5px) rotateX(0deg) rotateZ(' + anglez + 'deg)'
      }
      this.use2d = use2d;
      elation.html.transform(this.container, transform, origin, transition);
    }
    this.setSlot = function(slot, skipupdate) {
      this.unsetSlot();
      slot.element.appendChild(this.container);
      this.slot = slot;
      this.slot.addPiece(this);
    }
    this.unsetSlot = function() {
      if (this.slot) {
        this.container.parentNode.removeChild(this.container);
        this.slot.removePiece(this);
        this.moved++;
      }
    }
    this.render = function() {
      this.dragger.style.left = this.piecepos[0] + 'px';
      this.dragger.style.top = this.piecepos[1] + 'px';
      if (this.dragpos !== false) {
        (function(self) {
          requestAnimFrame(function() {
            self.render();
          });
        })(this);
      }
    }
    this.getSlot = function(pos) {
      var boarddims = elation.html.dimensions(this.game.boards['main'].element);
      var piecedims = elation.html.dimensions(this.container);
      var slotpos = [this.piecepos[0] + boarddims.x + piecedims.w/2, this.piecepos[1] + boarddims.y + piecedims.h/2];
      return this.game.boards['main'].getSlotFromPosition(slotpos[0], slotpos[1]);
    }
    /** Returns the full path, starting at startslot
      * capture specifies whether the piece can capture during this move
      *    0: no capturing
      *    1: normal capturing rules
      *    2: move is only valid if it results in a capture
      */
    this.getPath = function(startslot, dir, length, capture) {
      var path = [];
      var stop = false;
      if (typeof capture == 'undefined') {
        capture = 1; // default to normal capture rules
      }
      for (var i = 1; i <= length && !stop; i++) {
        var newrow = startslot.row + (i * dir[1]);
        var newcol = startslot.col + (i * dir[0]);
        var nextslot = this.game.boards['main'].getSlot(newrow, newcol);
        if (nextslot) {
          if (capture !== 2 && !nextslot.occupied) {
            path.push(nextslot);
          } else {
            if (capture && this.canCapture(nextslot)) {
              path.push(nextslot);
            }
            stop = true;
          }
        } else {
          stop = true;
        }
      }
      return path;
    }
    this.getLegalMoves = function() {
      var moves = [];
      var col = this.slot.col;
      var row = this.slot.row;
      var dir = (this.player == 'white' ? -1 : 1);

      if (this.game.legalmoves[this.type]) {
        for (var i = 0; i < this.game.legalmoves[this.type].length; i++) {
          var move = this.game.legalmoves[this.type][i];
          moves.push.apply(moves, this.getPath(this.slot, [move[0], move[1]], move[2], move[3]));
        }
      }
      switch (this.type) {
        case 'pawn': // pawns are magic, they can move 2 spots on their first move
          var nummoves = (this.moved ? 1 : 2);
          moves.push.apply(moves, this.getPath(this.slot, [-1, dir], 1, 2));
          moves.push.apply(moves, this.getPath(this.slot, [ 0, dir], nummoves, 0));
          moves.push.apply(moves, this.getPath(this.slot, [ 1, dir], 1, 2));

          // they can also capture en passant
          // FIXME - should only be able to capture en passant if the target was the last thing to move...
          var epslots = false;
          if (epslots = this.canEnpassant()) {
            moves.push.apply(moves, epslots);
          }
          break;
        case 'king': // Kings are mostly normal, but they can castle
          var castleslot;
          if (castleslot = this.canCastle(-1)) {
            moves.push(castleslot);
          }
          if (castleslot = this.canCastle(1)) {
            moves.push(castleslot);
          }
          break;
      }
      return moves;
    } 
    this.canCastle = function(dir) {
      if (this.type == 'king' && !this.moved) {
        var row = (this.player == 'white' ? 7 : 0);
        var path = this.getPath(this.slot, [dir, 0], 3, 0);
        var rookslot = this.game.boards['main'].getSlot(row, (dir == -1 ? 0 : 7));
        if (rookslot.occupied) {
          var rook = rookslot.pieces[0];
          if (rook.type == 'rook' && !rook.moved) {
            // FIXME - needs to make sure the king doesn't pass into or out of check
            return path[1];
          }
        }
      }
      return false;
    }
    this.canEnpassant = function(dir) {
      var slots = [];
      var movedir = (this.player == 'white' ? -1 : 1);
      if ((this.player == 'white' && this.slot.row == 3) ||
          (this.player == 'black' && this.slot.row == 4)) {
        var tryslots = [];
        if (typeof dir == 'undefined') {
          tryslots.push(this.game.boards['main'].getSlot(this.slot.row, this.slot.col - 1));
          tryslots.push(this.game.boards['main'].getSlot(this.slot.row, this.slot.col + 1));
        } else {
          tryslots.push(this.game.boards['main'].getSlot(this.slot.row, this.slot.col + dir));
        }
        for (var i = 0; i < tryslots.length; i++) {
          if (tryslots[i]) {
            var slot = tryslots[i]; 
            if (slot && slot.occupied && this.canCapture(slot)) {
              var epslot = this.game.boards['main'].getSlot(slot.row + movedir, slot.col);
              var piece = slot.pieces[0];
              if (epslot && piece.type == 'pawn' && piece.moved == 1) {
                slots.push(epslot);
              }
            }
          }
        }
      }
      return (slots.length > 0 ? slots : false);
    }
    this.canCapture = function(slot) {
      if (slot.occupied) {
        for (var i = 0; i < slot.pieces.length; i++) {
          if (slot.pieces[0].player != this.player) {
            return true;
          }
        }
      }
      return false;
    }
    this.capture = function(slot) {
      if (slot.occupied) {
        var piece = slot.pieces[0];
        piece.unsetSlot(); // FIXME - should add pieces to "prisoner" board
        delete this.game.pieces[piece.player][piece.name];
      }
    }
    this.pickup = function(dragpos) {
      if (this.player != this.game.activeplayer) { 
        return; 
      }
      this.oldparent = this.container.parentNode;
      elation.events.add(window, "mousemove,mouseup,touchmove,touchend", this);

      var pos = elation.html.dimensions(this.container);
      var boardpos = elation.html.dimensions(this.game.boards['main'].element);

      this.dragger = this.container.cloneNode(true);
      this.dragger.style.webkitTransition = 'all 0ms linear';
      this.dragger.style.position = 'absolute';
      this.piecepos = [pos.x - boardpos.x, pos.y - boardpos.y];
      this.dragger.style.left = this.piecepos[0] + 'px';
      this.dragger.style.top = this.piecepos[1] + 'px';
      this.container.style.opacity = .5;
      this.game.boards['main'].element.appendChild(this.dragger);
      this.dragpos = dragpos;
      this.dragslot = false;
      this.render();

      var moves = this.getLegalMoves();
      for (var i = 0; i < moves.length; i++) {
        moves[i].addClass('state_legal');
      }
      this.activemoves = moves;
    }
    this.move = function(dragpos) {
      var diff = [this.dragpos[0] - dragpos[0], this.dragpos[1] - dragpos[1]];
      var angley = -this.game.viewangle[0] * Math.PI/180;
      var anglex = (90 - this.game.viewangle[1]) * Math.PI/180;

      var cs = Math.cos(angley), sn = Math.sin(angley);
      var rot2d = [
        (diff[0] * cs - diff[1] * sn),
        (diff[0] * sn + diff[1] * cs)
      ];

      // FIXME - need to account for perspective and tilt
      /*
      cs = Math.cos(anglex);
      sn = Math.sin(anglex);
      var rot3d = [
        (rot2d[0] * cs - rot2d[1] * sn),
        (rot2d[0] * sn + rot2d[1] * cs)
      ];
      */

      this.piecepos[0] -= rot2d[0];
      this.piecepos[1] -= rot2d[1];
      this.dragpos = dragpos;
      var slot = this.getSlot(this.piecepos);
      if (this.dragslot && this.dragslot != slot) {
        this.dragslot.removeClass('state_hover');
      }
      if (slot) {
        slot.addClass('state_hover');
        this.dragslot = slot;
      }
    }
    this.drop = function(dragpos, skipupdate) {
      elation.events.remove(window, "mousemove,mouseup,touchmove,touchend", this);
      if (this.activemoves) {
        var slot = (dragpos instanceof elation.games.common.boardslot ? dragpos : this.getSlot(this.piecepos));
        if (slot && this.activemoves.indexOf(slot) != -1) {
var start = this.game.slotToRankFile(this.slot);
var end = this.game.slotToRankFile(slot);
        //console.log('move ' + this.type + ' from ' + start + ' to ' + end);
this.game.pieces[this.player]['king'].slot.removeClass('state_check');
if (this.game.move(start, end)) {
  var posstart = elation.html.position(this.slot.element);
  var posend = elation.html.position(slot.element);
  var offset = [posstart[0] - posend[0], posstart[1] - posend[1]];
  elation.html.transform(this.container, null, null, 'all 0ms ease-out');
  this.container.style.position = "relative";
  this.container.style.left = offset[0] + 'px';
  this.container.style.top = offset[1] + 'px';
  (function(c) {
    setTimeout(function() {
      elation.html.transform(c, null, null, 'all 400ms ease-out');
      c.style.left = 0 + 'px';
      c.style.top = 0 + 'px';
    }, 0);
  })(this.container);
          if (this.canCapture(slot)) {
            this.capture(slot);
          }
          if (!slot.occupied) {
            switch (this.type) {
              case 'king':
                // castling
                var movedist = slot.col - this.slot.col;
                if (Math.abs(movedist) == 2 && this.canCastle(movedist / 2)) {
                  var rookslot = this.game.boards['main'].getSlot(slot.row, (movedist < 0 ? 0 : 7));
                  var dropslot = this.game.boards['main'].getSlot(slot.row, (movedist < 0 ? 3 : 5));
                  if (rookslot && dropslot) {
                    rookslot.pieces[0].setSlot(dropslot, true);
                  }
                }
                break;
              case 'pawn':
                var endrow = (this.player == 'white' ? 0 : 7);
                if (slot.row == endrow) {
                  this.setType('queen'); // FIXME - pawns should get to choose their own career path
                } else if (!slot.occupied && slot.col != this.slot.col && this.canEnpassant()) {
                  var epslot = this.game.boards['main'].getSlot(this.slot.row, slot.col);
                  this.capture(epslot);
                }
                break;
            }
            this.setSlot(slot, skipupdate);
          } 
}
        }
        if (this.dragslot) {
          this.dragslot.removeClass('state_hover');
          this.dragslot = false;
        }
        this.dragpos = false;
        this.container.style.opacity = 1;
        if (this.dragger.parentNode = this.game.boards['main'].element) {
          this.game.boards['main'].element.removeChild(this.dragger);
        }

        // hide the active moves
        for (var i = 0; i < this.activemoves.length; i++) {
          this.activemoves[i].removeClass('state_legal');
        }
      }
    }

    /* events */
    this.handleEvent = function(ev) {
      if (typeof this[ev.type] == 'function') {
        return this[ev.type](ev);
      }
    }
    this.mousedown = function(ev) {
      if (ev.button == 0) {
        ev.stopPropagation();
        this.pickup([ev.clientX, ev.clientY]);
      }
    }
    this.mousemove = function(ev) {
      this.move([ev.clientX, ev.clientY]);
    }
    this.mouseup = function(ev) {
      this.drop([ev.clientX, ev.clientY]);
    }
    this.touchstart = function(ev) {
      if (ev.touches.length == 1) {
        this.pickup([ev.touches[0].clientX, ev.touches[0].clientY]);
        ev.preventDefault();
        ev.stopPropagation();
      }
    }
    this.touchmove = function(ev) {
      this.move([ev.touches[0].clientX, ev.touches[0].clientY]);
    }
    this.touchend = function(ev) {
      if (ev.touches.length == 0) {
        this.drop();
      }
    }
    
    this.init(); 
  }
});
