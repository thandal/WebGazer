(function() {

    self.webgazer = self.webgazer || {};
    self.webgazer.util = self.webgazer.util || {};
    self.webgazer.mat = self.webgazer.mat || {};


    /**
     * Eye class, represents an eye patch detected in the video stream
     * @param {ImageData} patch - the image data corresponding to an eye
     * @param {number} imagex - x-axis offset from the top-left corner of the video canvas
     * @param {number} imagey - y-axis offset from the top-left corner of the video canvas
     * @param {number} width  - width of the eye patch
     * @param {number} height - height of the eye patch
     */
    self.webgazer.util.Eye = function(patch, imagex, imagey, width, height) {
        this.patch = patch;
        this.imagex = imagex;
        this.imagey = imagey;
        this.width = width;
        this.height = height;
    };


    //Data Window class
    //operates like an array but 'wraps' data around to keep the array at a fixed windowSize
    /**
     * DataWindow class - Operates like an array, but 'wraps' data around to keep the array at a fixed windowSize
     * @param {number} windowSize - defines the maximum size of the window
     * @param {data} [data] - optional data to seed the DataWindow with
     **/
    self.webgazer.util.DataWindow = function(windowSize, data) {
        this.data = [];
        this.windowSize = windowSize;
        this.index = 0;
        this.length = 0;
        if(data){
            this.data = data.slice(data.length-windowSize,data.length);
            this.length = this.data.length;
        }
    };

    /**
     * [push description]
     * @param  {Any} entry - item to be inserted. It either grows the DataWindow or replaces the oldest item
     * @return {DataWindow} this
     */
    self.webgazer.util.DataWindow.prototype.push = function(entry) {
        if (this.data.length < this.windowSize) {
            this.data.push(entry);
            this.length = this.data.length;
            return this;
        }

        //replace oldest entry by wrapping around the DataWindow
        this.data[this.index] = entry;
        this.index = (this.index + 1) % this.windowSize;
        return this;
    };

    /**
     * Get the element at the ind position by wrapping around the DataWindow
     * @param  {number} ind index of desired entry
     * @return {Any}
     */
    self.webgazer.util.DataWindow.prototype.get = function(ind) {
        return this.data[this.getTrueIndex(ind)];
    };

    /**
     * Gets the true this.data array index given an index for a desired element
     * @param {number} ind - index of desired entry
     * @return {number} index of desired entry in this.data
     */
    self.webgazer.util.DataWindow.prototype.getTrueIndex = function(ind) {
        if (this.data.length < this.windowSize) {
            return ind;
        } else {
            //wrap around ind so that we can traverse from oldest to newest
            return (ind + this.index) % this.windowSize;
        }
    };

    /**
     * Append all the contents of data
     * @param {array} data - to be inserted
     */
    self.webgazer.util.DataWindow.prototype.addAll = function(data) {
        for (var i = 0; i < data.length; i++) {
            this.push(data[i]);
        }
    };


    //Helper functions
    /**
     * Grayscales an image patch. Can be used for the whole canvas, detected face, detected eye, etc.
     * @param  {ImageData} imageData - image data to be grayscaled
     * @param  {number} imageWidth  - width of image data to be grayscaled
     * @param  {number} imageHeight - height of image data to be grayscaled
     * @return {ImageData} grayscaledImage
     */
    self.webgazer.util.grayscale = function(imageData, imageWidth, imageHeight){
        //TODO implement ourselves to remove dependency
        return tracking.Image.grayscale(imageData, imageWidth, imageHeight, false);
    };

    /**
     * Increase contrast of an image
     * @param {ImageData} grayscaleImageSrc - grayscale integer array
     * @param {number} step - sampling rate, control performance
     * @param {array} destinationImage - array to hold the resulting image
     */
    self.webgazer.util.equalizeHistogram = function(grayscaleImageSrc, step, destinationImage) {
        //TODO implement ourselves to remove dependency
        return objectdetect.equalizeHistogram(grayscaleImageSrc, step, destinationImage);
    };

    /**
     * Gets an Eye object and resizes it to the desired resolution
     * @param  {webgazer.util.Eye} eye - patch to be resized
     * @param  {number} resizeWidth - desired width
     * @param  {number} resizeHeight - desired height
     * @return {webgazer.util.Eye} resized eye patch
     */
    self.webgazer.util.resizeEye = function(eye, resizeWidth, resizeHeight) {

        var canvas = document.createElement('canvas');
        canvas.width = eye.width;
        canvas.height = eye.height;

        canvas.getContext('2d').putImageData(eye.patch,0,0);

        var tempCanvas = document.createElement('canvas');

        tempCanvas.width = resizeWidth;
        tempCanvas.height = resizeHeight;

        // save the canvas into temp canvas
        tempCanvas.getContext('2d').drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, resizeWidth, resizeHeight);

        return tempCanvas.getContext('2d').getImageData(0, 0, resizeWidth, resizeHeight);
    };




    /**
     * Checks if the prediction is within the boundaries of the viewport and constrains it
     * @param  {array} prediction [x,y] predicted gaze coordinates
     * @return {array} constrained coordinates
     */
    self.webgazer.util.bound = function(prediction){
        if(prediction.x < 0)
            prediction.x = 0;
        if(prediction.y < 0)
            prediction.y = 0;
        var w = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        var h = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        if(prediction.x > w){
            prediction.x = w;
        }

        if(prediction.y > h)
        {
            prediction.y = h;
        }
        return prediction;
    };

    function debugBoxWrite(para, stats) {
        var str = '';
        for (var key in stats) {
            str += key + ': ' + stats[key] + '\n';
        }
        para.innerText = str;
    }

    self.webgazer.util.DebugBox = function(interval) {
        this.para = document.createElement('p');
        this.div = document.createElement('div');
        this.div.appendChild(this.para);
        document.body.appendChild(this.div);

        this.buttons = {};
        this.canvas = {};
        this.stats = {};
        var updateInterval = interval || 300;
        (function(localThis) {
            setInterval(function() {
                debugBoxWrite(localThis.para, localThis.stats);
            }, updateInterval);
        }(this));
    };

    self.webgazer.util.DebugBox.prototype.set = function(key, value) {
        this.stats[key] = value;
    };

    self.webgazer.util.DebugBox.prototype.inc = function(key, incBy, init) {
        if (!this.stats[key]) {
            this.stats[key] = init || 0;
        }
        this.stats[key] += incBy || 1;
    };

    self.webgazer.util.DebugBox.prototype.addButton = function(name, func) {
        if (!this.buttons[name]) {
            this.buttons[name] = document.createElement('button');
            this.div.appendChild(this.buttons[name]);
        }
        var button = this.buttons[name];
        this.buttons[name] = button;
        button.addEventListener('click', func);
        button.innerText = name;
    };

    self.webgazer.util.DebugBox.prototype.show = function(name, func) {
        if (!this.canvas[name]) {
            this.canvas[name] = document.createElement('canvas');
            this.div.appendChild(this.canvas[name]);
        }
        var canvas = this.canvas[name];
        canvas.getContext('2d').clearRect(0,0, canvas.width, canvas.height);
        func(canvas);
    };

    /**
     * Kalman Filter constructor
     * Kalman filters work by reducing the amount of noise in a models.
     * https://blog.cordiner.net/2011/05/03/object-tracking-using-a-kalman-filter-matlab/
     *
     * @param {array of arrays} F  		-> transition matrix
     * @param {array of arrays} Q		  -> process noise matrix
     * @param {array of arrays} H 		-> maps between measurement vector and noise matrix
     * @param {array of arrays} R     -> defines measurement error of the device
     * @param {array}           P_initial -> the initial state
     * @param {array}           X_initial -> the initial state of the device
     */
    self.webgazer.util.KalmanFilter = function(F, H, Q, R, P_initial, X_initial) {
        this.F = F; // State transition matrix
        this.Q = Q; // Process noise matrix
        this.H = H; // Transformation matrix
        this.R = R; // Measurement Noise
        this.P = P_initial; //Initial covariance matrix
        this.X = X_initial; //Initial guess of measurement
    };


    /**
     * Get Kalman next filtered value and update the internal state
     * @param {array} z  	-> the new measurement
     * @return {array}
     */
    self.webgazer.util.KalmanFilter.prototype.update = function(z) {

      // Here, we define all the different matrix operations we will need
      var add = numeric.add, sub = numeric.sub, inv = numeric.inv, identity = numeric.identity;
      var mult = webgazer.mat.mult, transpose = webgazer.mat.transpose;
      //TODO cache variables like the transpose of H

      // prediction: X = F * X  |  P = F * P * F' + Q
      var X_p = mult(this.F, this.X); //Update state vector
      var P_p = add(mult(mult(this.F,this.P), transpose(this.F)), this.Q); //Predicted covaraince

      //Calculate the update values
      var y = sub(z, mult(this.H, X_p)); // This is the measurement error (between what we expect and the actual value)
      var S = add(mult(mult(this.H, P_p), transpose(this.H)), this.R); //This is the residual covariance (the error in the covariance)

      // kalman multiplier: K = P * H' * (H * P * H' + R)^-1
      var K = mult(P_p, mult(transpose(this.H), inv(S))); //This is the Optimal Kalman Gain

      //We need to change Y into it's column vector form
      for(var i = 0; i < y.length; i++){
        y[i] = [y[i]];
      }

      //Now we correct the internal values of the model
      // correction: X = X + K * (m - H * X)  |  P = (I - K * H) * P
      this.X = add(X_p, mult(K, y));
      this.P = mult(sub(identity(K.length), mult(K,this.H)), P_p);
      return transpose(mult(this.H, this.X))[0]; //Transforms the predicted state back into it's measurement form
    }

}());
