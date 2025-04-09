// src/objects/index.js

// Import all object components
import { Tree } from './Tree';
import { Shrub } from './Shrub';
import { Grass } from './Grass';
import { DeciduousTree } from './DeciduousTree';
import { Hedge } from './Hedge';
import { SmallFruitBush } from './SmallFruitBush';
import { GroundFruit } from './GroundFruit';
import { SmallFlower } from './SmallFlower';
import { SteppingStone } from './SteppingStone';
import { RectSteppingStone } from './RectSteppingStone';
import { RaisedBed } from './RaisedBed';
import { Car } from './Car';
import { GardenLight } from './GardenLight';
import { Pergola } from './Pergola';
import { GravelPatch } from './GravelPatch';
import { House } from './House';

// Create the component map
export const ObjectComponents = {
    tree: Tree,
    deciduous_tree: DeciduousTree,
    shrub: Shrub,
    grass: Grass,
    hedge: Hedge,
    small_fruit_bush: SmallFruitBush,
    ground_fruit: GroundFruit,
    ground_flower: SmallFlower,
    stepping_stone: SteppingStone,
    rect_stepping_stone: RectSteppingStone,
    raised_bed: RaisedBed,
    car: Car,
    garden_light: GardenLight,
    pergola: Pergola,
    gravel_patch: GravelPatch,
    house: House,
};

// Re-export configurations
import { objectConfigurations } from './configurations';
export { objectConfigurations };
