/*****************************************************************************
 * Open MCT, Copyright (c) 2014-2019, United States Government
 * as represented by the Administrator of the National Aeronautics and Space
 * Administration. All rights reserved.
 *
 * Open MCT is licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 *
 * Open MCT includes source code licensed under additional open source
 * licenses. See the Open Source Licenses file (LICENSES.md) included with
 * this source code distribution or the Licensing information page available
 * at runtime from the About dialog for additional information.
 *****************************************************************************/

import * as EventEmitter from 'eventemitter3';

export default class TelemetryCriterion extends EventEmitter {

    constructor(telemetryDomainObject, openmct) {
        super();

        this.openmct = openmct;
        console.log(telemetryDomainObject);
        this.telemetryAPI = this.openmct.telemetry;
        this.objectAPI = this.openmct.objects;
        this.subscription = null;
        this.telemetryMetadata = null;
        this.telemetryObject = telemetryDomainObject;
        this.telemetryObjectIdAsString = this.objectAPI.makeKeyString(this.telemetryObject.identifier);
    }

    handleSubscription(datum) {
        //data is telemetry values, error
        //how do I get data here?
        this.emitResult(this.normalizeData(datum));
    }

    //TODO: Revisit this logic
    normalizeData(datum) {
        return {
            [datum.key]: datum[datum.source]
        }
    }

    emitResult(data, error) {
        this.emit('criterionUpdated', {
            identifier: this.telemetryObjectIdAsString,
            data: data,
            error: error
        });
    }

    /**
     *  Subscribes to the telemetry object and returns an unsubscribe function
     */
    subscribe() {
        this.subscription = this.telemetryAPI.subscribe(this.telemetryObject, (datum) => {
            this.handleSubscription(datum);
        });
    }

    /**
     *  Calls an unsubscribe function returned by subscribe() and deletes any initialized data
     */
    unsubscribe() {
        //unsubscribe from telemetry source
        if (typeof this.subscription === 'function') {
            this.subscription();
        }
        delete this.subscription;
        this.emit('criterion::Remove', this.telemetryObjectIdAsString);
        delete this.telemetryObjectIdAsString;
        delete this.telemetryObject;
        delete this.telemetryMetadata;
    }
}